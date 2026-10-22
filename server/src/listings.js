// Объявления: загрузка и проверка билета, создание, списки, снятие с продажи.
// Что сервер проверяет на самом деле: формат файла (по сигнатуре), дубли файла (SHA-256),
// подтверждённый номер продавца, цену ≤ номинала зоны. Штрихкод с организатором не сверяется.
import {
  MAX_FILE_MB,
  MAX_QUANTITY,
  NEW_SELLER_ACTIVE_LIMIT,
  findZone,
  listingTitle,
  priceError,
  seatsError,
} from '../../shared/listingRules.js';
import { HttpError } from './errors.js';
import { upcomingEvent } from './events.js';
import { detectKind, kindLabel, sha256, storeFile } from './ticketFiles.js';

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const isUniqueViolation = (err) => err?.code === '23505';

// Допуск к продаже — защита от мошенников без юрлица:
//   • номер телефона подтверждён подписью Telegram (сим-карты в РФ — по паспорту);
//   • пока нет завершённых продаж — не больше NEW_SELLER_ACTIVE_LIMIT активных объявлений.
async function assertCanSell(db, user) {
  if (user.blocked_at) {
    throw new HttpError(403, 'blocked', 'Продажа для вашего аккаунта закрыта. Если это ошибка — напишите в поддержку');
  }
  if (!user.phone_verified_at) {
    throw new HttpError(403, 'phone_required', 'Чтобы продавать, подтвердите номер телефона');
  }
  const [{ active, sold }] = await db.query(
    `SELECT count(*) FILTER (WHERE status = 'active')::int AS active,
            count(*) FILTER (WHERE status = 'sold')::int AS sold
     FROM listings WHERE seller_id = $1`,
    [user.id],
  );
  if (sold === 0 && active >= NEW_SELLER_ACTIVE_LIMIT) {
    throw new HttpError(
      403,
      'new_seller_limit',
      `Пока нет завершённых продаж, можно держать не больше ${NEW_SELLER_ACTIVE_LIMIT} объявлений одновременно`,
    );
  }
}

// «Алексей М.» — имя и первая буква фамилии, как у демо-продавцов
export const sellerName = (row) => [row.first_name, row.last_name ? `${row.last_name[0]}.` : null].filter(Boolean).join(' ');

// Строка БД → лот в том же формате, что демо-лоты витрины
export function toOffer(row, viewerId) {
  return {
    id: row.id,
    eventId: row.event_id,
    zone: row.zone,
    title: row.title,
    details: `${kindLabel(row.file_kind)} • файл проверен`,
    delivery: row.file_kind === 'pdf' ? 'PDF' : 'Фото → PDF',
    eTicket: true,
    nominal: row.nominal,
    price: row.price,
    quantity: row.quantity,
    // «Проверен» = продавец с подтверждённым номером; подлинность билета не утверждаем
    verified: Boolean(row.phone_verified_at),
    seller: {
      name: sellerName(row),
      rating: null,
      sales: Number(row.seller_sales ?? 0),
      phoneVerified: Boolean(row.phone_verified_at),
    },
    own: viewerId != null && Number(row.seller_id) === Number(viewerId),
    status: row.status,
    // Причину снятия модератором видит продавец в «Моих объявлениях»
    removedReason: row.status === 'removed' ? row.removed_reason : undefined,
    createdAt: row.created_at,
  };
}

export const LISTING_SELECT = `
  SELECT l.*, u.first_name, u.last_name, u.phone_verified_at,
         (SELECT count(*) FROM listings s WHERE s.seller_id = l.seller_id AND s.status = 'sold') AS seller_sales
  FROM listings l JOIN users u ON u.id = l.seller_id`;

export function registerListingRoutes(app, { db, config, requireUser, optionalUser }) {
  // Все активные объявления — для витрины и страниц событий
  app.get('/api/listings', { preHandler: optionalUser }, async (req) => {
    const rows = await db.query(`${LISTING_SELECT} WHERE l.status = 'active' ORDER BY l.created_at DESC LIMIT 500`);
    return { listings: rows.map((r) => toOffer(r, req.user?.id)) };
  });

  // Мои объявления, включая снятые
  app.get('/api/me/listings', { preHandler: requireUser }, async (req) => {
    const rows = await db.query(`${LISTING_SELECT} WHERE l.seller_id = $1 ORDER BY l.created_at DESC`, [req.user.id]);
    return { listings: rows.map((r) => toOffer(r, req.user.id)) };
  });

  // Шаг «Загрузите билет»: multipart с полями eventId и file
  app.post('/api/ticket-checks', { preHandler: requireUser }, async (req, reply) => {
    await assertCanSell(db, req.user); // до загрузки файла — не принимаем его зря
    let part;
    try {
      part = await req.file({ limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1, fields: 5 } });
    } catch {
      throw new HttpError(400, 'bad_request', 'Ожидается файл билета');
    }
    if (!part) throw new HttpError(400, 'bad_request', 'Файл не прикреплён');

    let buf;
    try {
      buf = await part.toBuffer();
    } catch (err) {
      if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new HttpError(413, 'file_too_large', `Файл больше ${MAX_FILE_MB} МБ — сожмите его или сделайте скриншот`);
      }
      throw err;
    }

    const event = await upcomingEvent(db, part.fields.eventId?.value);
    const kind = detectKind(buf);
    if (!kind) throw new HttpError(415, 'unsupported_file', 'Нужен PDF или фото билета (JPG, PNG, HEIC)');

    // Дубли: тот же файл уже в активном объявлении — второй раз выставить нельзя.
    // Это поиск по содержимому файла, а не по штрихкоду: другой скриншот того же билета пройдёт.
    const hash = sha256(buf);
    const [dup] = await db.query(`SELECT seller_id FROM listings WHERE file_sha256 = $1 AND status = 'active'`, [hash]);
    if (dup) {
      const mine = Number(dup.seller_id) === Number(req.user.id);
      throw new HttpError(409, 'duplicate', mine ? 'Вы уже продаёте этот билет' : 'Этот билет уже продаётся на Tickety');
    }

    const [check] = await db.query(
      `INSERT INTO ticket_checks (user_id, event_id, file_sha256, file_kind, file_size)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.user.id, event.id, hash, kind, buf.length],
    );
    await storeFile(config.uploadDir, hash, kind, buf);

    reply.code(201);
    return { checkId: check.id, fileKind: kindLabel(kind) };
  });

  // Шаг «Выставить на продажу»: зону и места указывает продавец, номинал — из прайса зоны
  // (поля nominal в API нет), цена ≤ номинала проверяется здесь и ограничением в базе
  app.post(
    '/api/listings',
    {
      preHandler: requireUser,
      schema: {
        body: {
          type: 'object',
          required: ['checkId', 'zone', 'price', 'quantity'],
          additionalProperties: false,
          properties: {
            checkId: { type: 'string', pattern: UUID },
            zone: { type: 'string', maxLength: 32 },
            price: { type: 'integer' },
            quantity: { type: 'integer', minimum: 1, maximum: MAX_QUANTITY },
            sector: { type: 'string', maxLength: 16 },
            row: { type: 'string', maxLength: 16 },
            seat: { type: 'string', maxLength: 16 },
          },
        },
      },
    },
    async (req, reply) => {
      const { checkId, price, quantity } = req.body;
      await assertCanSell(db, req.user);
      const [check] = await db.query(`SELECT * FROM ticket_checks WHERE id = $1 AND user_id = $2`, [checkId, req.user.id]);
      if (!check) throw new HttpError(404, 'check_not_found', 'Проверка билета не найдена — загрузите файл заново');
      const event = await upcomingEvent(db, check.event_id);

      const zone = findZone(event.zones, req.body.zone);
      if (!zone) throw new HttpError(400, 'bad_zone', 'Такой зоны на этом событии нет');
      const seats = zone.seated ? { sector: req.body.sector ?? '', row: req.body.row ?? '', seat: req.body.seat ?? '' } : {};
      const seatsProblem = seatsError(zone, seats);
      if (seatsProblem) throw new HttpError(400, 'bad_seats', seatsProblem);
      const error = priceError(price, zone.nominal);
      if (error) throw new HttpError(400, 'bad_price', error);

      let row;
      try {
        [row] = await db.query(
          `INSERT INTO listings (seller_id, event_id, check_id, file_sha256, zone, title, file_kind, nominal, price, quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [req.user.id, check.event_id, check.id, check.file_sha256, zone.id, listingTitle(zone, seats), check.file_kind, zone.nominal, price, quantity],
        );
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new HttpError(409, 'duplicate', err.constraint === 'listings_check_id_key'
            ? 'По этой проверке объявление уже создано'
            : 'Этот билет уже продаётся на Tickety');
        }
        throw err;
      }

      const [full] = await db.query(`${LISTING_SELECT} WHERE l.id = $1`, [row.id]);
      reply.code(201);
      return { listing: toOffer(full, req.user.id) };
    },
  );

  app.post(
    '/api/listings/:id/withdraw',
    { preHandler: requireUser, schema: { params: { type: 'object', properties: { id: { type: 'string', pattern: UUID } } } } },
    async (req) => {
      const [row] = await db.query(
        `UPDATE listings SET status = 'withdrawn', withdrawn_at = now()
         WHERE id = $1 AND seller_id = $2 AND status = 'active' RETURNING id`,
        [req.params.id, req.user.id],
      );
      if (!row) throw new HttpError(404, 'listing_not_found', 'Активное объявление не найдено');
      const [full] = await db.query(`${LISTING_SELECT} WHERE l.id = $1`, [row.id]);
      return { listing: toOffer(full, req.user.id) };
    },
  );
}
