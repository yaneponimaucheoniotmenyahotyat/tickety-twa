// Объявления: загрузка и проверка билета, создание, списки, снятие с продажи.
import { ZONES, events, offers as demoOffers } from '../../shared/catalog.js';
import { MAX_FILE_MB, MAX_QUANTITY, listingTitle, priceError, recognizeTicket } from '../../shared/listingRules.js';
import { detectKind, kindLabel, sha256, storeFile } from './ticketFiles.js';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const isUniqueViolation = (err) => err?.code === '23505';

function upcomingEvent(eventId) {
  const event = events.find((e) => e.id === eventId);
  if (!event) throw new HttpError(404, 'event_not_found', 'Такого события нет');
  if (new Date(event.date) <= new Date()) throw new HttpError(400, 'event_past', 'Событие уже прошло');
  return event;
}

// «Алексей М.» — имя и первая буква фамилии, как у демо-продавцов
const sellerName = (row) => [row.first_name, row.last_name ? `${row.last_name[0]}.` : null].filter(Boolean).join(' ');

// Строка БД → лот в том же формате, что демо-лоты витрины
function toOffer(row, viewerId) {
  return {
    id: row.id,
    eventId: row.event_id,
    zone: row.zone,
    title: row.title,
    details: `${kindLabel(row.file_kind)} • проверен Tickety AI`,
    delivery: row.file_kind === 'pdf' ? 'PDF' : 'Фото → PDF',
    eTicket: true,
    nominal: row.nominal,
    price: row.price,
    quantity: row.quantity,
    verified: true,
    seller: { name: sellerName(row), rating: null, sales: Number(row.seller_sales ?? 0) },
    own: viewerId != null && Number(row.seller_id) === Number(viewerId),
    status: row.status,
    createdAt: row.created_at,
  };
}

const LISTING_SELECT = `
  SELECT l.*, u.first_name, u.last_name,
         (SELECT count(*) FROM listings s WHERE s.seller_id = l.seller_id AND s.status = 'sold') AS seller_sales
  FROM listings l JOIN users u ON u.id = l.seller_id`;

export function registerListingRoutes(app, { db, config, requireUser, optionalUser }) {
  // Все активные объявления — витрина подмешивает их к демо-лотам
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

    const event = upcomingEvent(part.fields.eventId?.value);
    const kind = detectKind(buf);
    if (!kind) throw new HttpError(415, 'unsupported_file', 'Нужен PDF или фото билета (JPG, PNG, HEIC)');

    const hash = sha256(buf);
    const seed = parseInt(hash.slice(0, 8), 16);
    const details = recognizeTicket(
      seed,
      demoOffers.filter((o) => o.eventId === event.id),
      kindLabel(kind),
    );

    // «Ищем дубли»: этот билет уже продаётся — второй раз выставить нельзя
    const [dup] = await db.query(`SELECT seller_id FROM listings WHERE barcode = $1 AND status = 'active'`, [details.barcode]);
    if (dup) {
      const mine = Number(dup.seller_id) === Number(req.user.id);
      throw new HttpError(409, 'duplicate', mine ? 'Вы уже продаёте этот билет' : 'Этот билет уже продаётся на Tickety');
    }

    const [check] = await db.query(
      `INSERT INTO ticket_checks (user_id, event_id, file_sha256, file_kind, file_size, zone, seated, sector, row_label, seat_label, nominal, barcode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [req.user.id, event.id, hash, kind, buf.length, details.zone, details.seated, details.sector, details.row, details.seat, details.nominal, details.barcode],
    );
    await storeFile(config.uploadDir, hash, kind, buf);

    reply.code(201);
    return { checkId: check.id, details };
  });

  // Шаг «Выставить на продажу»: номинал и зона берутся из проверки, от клиента — только цена,
  // количество и правка мест
  app.post(
    '/api/listings',
    {
      preHandler: requireUser,
      schema: {
        body: {
          type: 'object',
          required: ['checkId', 'price', 'quantity'],
          additionalProperties: false,
          properties: {
            checkId: { type: 'string', pattern: UUID },
            price: { type: 'integer' },
            quantity: { type: 'integer', minimum: 1, maximum: MAX_QUANTITY },
            sector: { type: 'string', maxLength: 8 },
            row: { type: 'string', maxLength: 8 },
            seat: { type: 'string', maxLength: 8 },
          },
        },
      },
    },
    async (req, reply) => {
      const { checkId, price, quantity } = req.body;
      const [check] = await db.query(`SELECT * FROM ticket_checks WHERE id = $1 AND user_id = $2`, [checkId, req.user.id]);
      if (!check) throw new HttpError(404, 'check_not_found', 'Проверка билета не найдена — загрузите файл заново');
      upcomingEvent(check.event_id);

      const error = priceError(price, check.nominal);
      if (error) throw new HttpError(400, 'bad_price', error);

      const details = {
        seated: check.seated,
        zoneLabel: ZONES[check.zone],
        sector: check.seated ? (req.body.sector ?? check.sector) : '',
        row: check.seated ? (req.body.row ?? check.row_label) : '',
        seat: check.seated ? (req.body.seat ?? check.seat_label) : '',
      };

      let row;
      try {
        [row] = await db.query(
          `INSERT INTO listings (seller_id, event_id, check_id, barcode, zone, title, file_kind, nominal, price, quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [req.user.id, check.event_id, check.id, check.barcode, check.zone, listingTitle(details), check.file_kind, check.nominal, price, quantity],
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
