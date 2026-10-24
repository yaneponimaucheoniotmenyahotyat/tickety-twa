// Регистрация и публичная оферта: без имени и фамилии и без согласия с текущей редакцией оферты
// нельзя продавать, покупать и выводить деньги. Смотреть витрину и писать в поддержку — можно.
import { OFFER } from '../../shared/legal/offer.js';
import { cleanName, nameError } from '../../shared/nameRules.js';
import { HttpError } from './errors.js';

export async function offerAccepted(db, userId) {
  const [row] = await db.query(
    `SELECT accepted_at FROM legal_acceptances WHERE user_id = $1 AND document = $2 AND version = $3`,
    [userId, OFFER.id, OFFER.version],
  );
  return row?.accepted_at ?? null;
}

export async function assertOfferAccepted(db, config, user) {
  if (config.registrationRequired && !user.registered_at) {
    throw new HttpError(403, 'registration_required', 'Чтобы покупать и продавать, укажите имя и фамилию в профиле');
  }
  if (!config.offerRequired) return;
  if (!(await offerAccepted(db, user.id))) {
    throw new HttpError(403, 'offer_required', 'Чтобы покупать и продавать, примите условия публичной оферты');
  }
}

export function registerLegalRoutes(app, { db, requireUser, userWithAccess }) {
  // Регистрация и правка имени. После первой сделки имя меняется только через поддержку:
  // иначе продавец мог бы сменить имя после спорной продажи.
  app.post(
    '/api/me/registration',
    {
      preHandler: requireUser,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['firstName', 'lastName'],
          properties: { firstName: { type: 'string', maxLength: 80 }, lastName: { type: 'string', maxLength: 80 } },
        },
      },
    },
    async (req) => {
      const error = nameError(req.body.firstName, 'Имя') ?? nameError(req.body.lastName, 'Фамилия');
      if (error) throw new HttpError(400, 'bad_name', error);
      const first = cleanName(req.body.firstName);
      const last = cleanName(req.body.lastName);

      if (req.user.registered_at && (first !== req.user.real_first_name || last !== req.user.real_last_name)) {
        const [{ n }] = await db.query(
          `SELECT count(*)::int AS n FROM orders WHERE (buyer_id = $1 OR seller_id = $1) AND status <> 'cancelled'`,
          [req.user.id],
        );
        if (n > 0) throw new HttpError(409, 'name_locked', 'После первой сделки имя и фамилию можно изменить только через поддержку');
      }
      const [row] = await db.query(
        `UPDATE users SET real_first_name = $2, real_last_name = $3, registered_at = COALESCE(registered_at, now())
         WHERE id = $1
         RETURNING id, first_name, last_name, username, photo_url, is_premium, allows_write_to_pm,
                   phone, phone_verified_at, blocked_at, real_first_name, real_last_name, registered_at, created_at`,
        [req.user.id, first, last],
      );
      return { user: await userWithAccess(row) };
    },
  );

  // Согласие с конкретной редакцией: устаревшую принять нельзя — приложение должно показать новую
  app.post(
    '/api/me/accept-offer',
    {
      preHandler: requireUser,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { version: { type: 'string', maxLength: 32 } },
        },
      },
    },
    async (req) => {
      if (req.body.version !== OFFER.version) {
        throw new HttpError(409, 'offer_outdated', 'Условия обновились — откройте приложение заново и прочитайте новую редакцию');
      }
      await db.query(
        `INSERT INTO legal_acceptances (user_id, document, version) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [req.user.id, OFFER.id, OFFER.version],
      );
      return { offer: { version: OFFER.version, acceptedAt: await offerAccepted(db, req.user.id) } };
    },
  );
}
