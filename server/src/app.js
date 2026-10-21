import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { HttpError, registerListingRoutes } from './listings.js';
import { AuthError, validateContact, validateInitData } from './telegramAuth.js';

// Сборка приложения отдельно от запуска — тесты поднимают его без сети (app.inject)
export async function buildApp({ config, db, logger = false }) {
  const app = Fastify({
    logger,
    trustProxy: true,
    // Лишние поля в теле — ошибка 400, а не молчаливое удаление: попытка подсунуть,
    // например, свой nominal должна быть видна, а не тихо проглочена
    ajv: { customOptions: { removeAdditional: false } },
  });

  await app.register(cors, {
    origin: config.allowedOrigins,
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });
  await app.register(multipart);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AuthError) return reply.code(401).send({ error: 'unauthorized', message: err.message });
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.code, message: err.message });
    if (err.validation) return reply.code(400).send({ error: 'bad_request', message: err.message });
    req.log.error(err);
    return reply.code(500).send({ error: 'internal', message: 'Что-то пошло не так' });
  });

  // Кто делает запрос. Заголовок:
  //   Authorization: tma <initData>  — из Telegram (основной путь)
  //   Authorization: dev <userId>    — только при ALLOW_DEV_AUTH=1 вне production
  function authenticate(req) {
    const header = req.headers.authorization ?? '';
    const [scheme, ...rest] = header.split(' ');
    const value = rest.join(' ');

    if (scheme === 'tma') {
      return validateInitData(value, config.botToken, { maxAgeSec: config.initDataMaxAge }).user;
    }
    if (scheme === 'dev' && config.allowDevAuth && /^\d+$/.test(value)) {
      return { id: Number(value), first_name: 'Dev', username: `dev${value}` };
    }
    throw new AuthError('authorization required');
  }

  // Пользователь создаётся при первом запросе и освежается при каждом следующем:
  // имя, @username и аватар в Telegram могут поменяться
  async function upsertUser(u) {
    const [row] = await db.query(
      `INSERT INTO users (id, first_name, last_name, username, photo_url, language_code, is_premium, allows_write_to_pm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         username = EXCLUDED.username,
         photo_url = EXCLUDED.photo_url,
         language_code = EXCLUDED.language_code,
         is_premium = EXCLUDED.is_premium,
         allows_write_to_pm = users.allows_write_to_pm OR EXCLUDED.allows_write_to_pm,
         last_seen_at = now()
       RETURNING id, first_name, last_name, username, photo_url, is_premium, allows_write_to_pm,
                 phone, phone_verified_at, created_at, last_seen_at, (xmax = 0) AS inserted`,
      [
        u.id,
        u.first_name ?? '',
        u.last_name ?? null,
        u.username ?? null,
        u.photo_url ?? null,
        u.language_code ?? null,
        Boolean(u.is_premium),
        Boolean(u.allows_write_to_pm),
      ],
    );
    return row;
  }

  app.decorateRequest('user', null);
  const requireUser = async (req) => {
    req.user = await upsertUser(authenticate(req));
  };
  // Для публичных списков: без заголовка — гость, с неверной подписью — 401
  const optionalUser = async (req) => {
    if (req.headers.authorization) await requireUser(req);
  };

  // Номер целиком наружу не отдаём даже владельцу: в интерфейсе хватает последних цифр
  const maskPhone = (phone) => (phone ? `${phone.slice(0, 2)} ••• •••-${phone.slice(-4, -2)}-${phone.slice(-2)}` : null);

  const publicUser = (row) => ({
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    photoUrl: row.photo_url,
    isPremium: row.is_premium,
    allowsWriteToPm: row.allows_write_to_pm,
    phoneVerified: Boolean(row.phone_verified_at),
    phoneMasked: maskPhone(row.phone),
    createdAt: row.created_at,
  });

  app.get('/api/health', async () => {
    await db.query('SELECT 1');
    return { ok: true, db: db.kind };
  });

  app.get('/api/me', { preHandler: requireUser }, async (req) => ({
    user: publicUser(req.user),
    isNew: req.user.inserted,
  }));

  // Подтверждение номера: тело — сырая строка response из WebApp.requestContact.
  // Подпись проверяется токеном бота; номер должен принадлежать тому, кто вошёл.
  app.post(
    '/api/me/phone',
    {
      preHandler: requireUser,
      schema: {
        body: {
          type: 'object',
          required: ['response'],
          additionalProperties: false,
          properties: { response: { type: 'string', minLength: 1, maxLength: 4096 } },
        },
      },
    },
    async (req) => {
      const contact = validateContact(req.body.response, config.botToken);
      if (contact.userId !== Number(req.user.id)) {
        throw new HttpError(400, 'foreign_contact', 'Это не ваш номер — поделитесь своим контактом');
      }
      const [row] = await db.query(
        `UPDATE users SET phone = $2, phone_verified_at = now() WHERE id = $1
         RETURNING id, first_name, last_name, username, photo_url, is_premium, allows_write_to_pm,
                   phone, phone_verified_at, created_at`,
        [req.user.id, contact.phone],
      );
      await db.query(
        `INSERT INTO identity_verifications (user_id, method, subject) VALUES ($1, 'telegram_phone', $2)`,
        [req.user.id, contact.phone],
      );
      return { user: publicUser(row) };
    },
  );

  registerListingRoutes(app, { db, config, requireUser, optionalUser });

  return app;
}
