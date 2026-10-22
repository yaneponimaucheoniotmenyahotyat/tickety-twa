// Админка: события с прайсом зон и модерация объявлений.
// Доступ — только ADMIN_IDS (requireAdmin); каждое действие пишется в admin_actions.
import { randomBytes } from 'node:crypto';
import { SEATING, eventError } from '../../shared/eventRules.js';
import { HttpError } from './errors.js';
import { loadEvents } from './events.js';
import { LISTING_SELECT, toOffer } from './listings.js';

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const str = (maxLength) => ({ type: 'string', maxLength });
const nullableStr = (maxLength) => ({ type: ['string', 'null'], maxLength });

const eventBody = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'category', 'date', 'venue', 'city', 'cover', 'status', 'zones'],
  properties: {
    title: str(120),
    category: str(16),
    date: str(40),
    doorsOpen: nullableStr(5),
    venue: str(120),
    city: str(60),
    address: str(200),
    description: str(1000),
    tags: { type: 'array', maxItems: 6, items: str(30) },
    cover: { type: 'array', items: str(7) },
    sourceUrl: nullableStr(500),
    status: { type: 'string', enum: ['published', 'hidden'] },
    zones: {
      type: 'array',
      maxItems: 50, // точный лимит — в eventError, с понятной формулировкой
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'nominal', 'seating'],
        properties: {
          id: str(16),
          label: str(40),
          nominal: { type: 'integer' },
          seating: str(8),
        },
      },
    },
  },
};

const reasonBody = {
  type: 'object',
  additionalProperties: false,
  required: ['reason'],
  properties: { reason: { type: 'string', minLength: 3, maxLength: 300 } },
};

const newId = (prefix) => `${prefix}${randomBytes(4).toString('hex')}`;
const clean = (s) => (typeof s === 'string' ? s.trim() : '');

function checkEvent(body) {
  const error = eventError(body);
  if (error) throw new HttpError(400, 'bad_event', error);
}

function eventValues(b) {
  return [
    clean(b.title),
    b.category,
    (b.tags ?? []).map(clean).filter(Boolean),
    new Date(b.date).toISOString(),
    b.doorsOpen || null,
    clean(b.venue),
    clean(b.city),
    clean(b.address),
    clean(b.description),
    b.cover,
    clean(b.sourceUrl) || null,
    b.status,
  ];
}

async function saveZones(t, eventId, zones) {
  for (const [position, z] of zones.entries()) {
    const { seated, needsSector } = SEATING[z.seating];
    await t.query(
      `INSERT INTO event_zones (event_id, id, label, nominal, seated, needs_sector, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (event_id, id) DO UPDATE SET
         label = EXCLUDED.label, nominal = EXCLUDED.nominal, seated = EXCLUDED.seated,
         needs_sector = EXCLUDED.needs_sector, position = EXCLUDED.position`,
      [eventId, z.id || newId('z'), clean(z.label), z.nominal, seated, needsSector, position],
    );
  }
}

const logAction = (q, adminId, action, targetType, targetId, reason = null) =>
  q.query(
    `INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES ($1, $2, $3, $4, $5)`,
    [adminId, action, targetType, String(targetId), reason],
  );

// Активные объявления по событиям — чтобы в админке было видно, что затронет правка
async function activeCounts(db) {
  const rows = await db.query(`SELECT event_id, count(*)::int AS n FROM listings WHERE status = 'active' GROUP BY event_id`);
  return new Map(rows.map((r) => [r.event_id, r.n]));
}

export function registerAdminRoutes(app, { db, requireAdmin }) {
  const eventParams = { type: 'object', properties: { id: str(32) } };

  // Все события, включая скрытые и прошедшие
  app.get('/api/admin/events', { preHandler: requireAdmin }, async () => {
    const [events, counts] = await Promise.all([loadEvents(db), activeCounts(db)]);
    return { events: events.map((e) => ({ ...e, activeListings: counts.get(e.id) ?? 0 })) };
  });

  app.post('/api/admin/events', { preHandler: requireAdmin, schema: { body: eventBody } }, async (req, reply) => {
    checkEvent(req.body);
    if (req.body.zones.some((z) => z.id)) throw new HttpError(400, 'bad_event', 'У новых зон не должно быть id');
    const id = newId('ev');
    await db.tx(async (t) => {
      await t.query(
        `INSERT INTO events (title, category, tags, starts_at, doors_open, venue, city, address, description, cover,
                             source_url, status, id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [...eventValues(req.body), id, req.user.id],
      );
      await saveZones(t, id, req.body.zones);
      await logAction(t, req.user.id, 'event_create', 'event', id);
    });
    const [event] = await loadEvents(db, 'e.id = $1', [id]);
    reply.code(201);
    return { event: { ...event, activeListings: 0 } };
  });

  // Правка события целиком. Зоны: с id — обновить, без id — новые, пропавшие — удалить.
  // Номинал уже выставленных объявлений не меняется: он зафиксирован в момент публикации.
  app.put(
    '/api/admin/events/:id',
    { preHandler: requireAdmin, schema: { params: eventParams, body: eventBody } },
    async (req) => {
      checkEvent(req.body);
      const { id } = req.params;
      await db.tx(async (t) => {
        const existing = await t.query(`SELECT id FROM event_zones WHERE event_id = $1`, [id]);
        const [found] = await t.query(`SELECT id FROM events WHERE id = $1 FOR UPDATE`, [id]);
        if (!found) throw new HttpError(404, 'event_not_found', 'Такого события нет');

        const known = new Set(existing.map((z) => z.id));
        const unknown = req.body.zones.find((z) => z.id && !known.has(z.id));
        if (unknown) throw new HttpError(400, 'bad_event', `Зоны «${unknown.label}» у события нет`);

        const kept = new Set(req.body.zones.map((z) => z.id).filter(Boolean));
        const dropped = existing.map((z) => z.id).filter((zid) => !kept.has(zid));
        if (dropped.length) {
          const [{ n }] = await t.query(
            `SELECT count(*)::int AS n FROM listings WHERE event_id = $1 AND zone = ANY($2) AND status = 'active'`,
            [id, dropped],
          );
          if (n > 0) {
            throw new HttpError(409, 'zone_in_use', 'В удаляемой зоне есть билеты в продаже — сначала снимите их');
          }
          await t.query(`DELETE FROM event_zones WHERE event_id = $1 AND id = ANY($2)`, [id, dropped]);
        }

        await t.query(
          `UPDATE events SET title = $1, category = $2, tags = $3, starts_at = $4, doors_open = $5, venue = $6,
                  city = $7, address = $8, description = $9, cover = $10, source_url = $11, status = $12,
                  updated_at = now()
           WHERE id = $13`,
          [...eventValues(req.body), id],
        );
        await saveZones(t, id, req.body.zones);
        await logAction(t, req.user.id, 'event_update', 'event', id);
      });
      const [[event], counts] = await Promise.all([loadEvents(db, 'e.id = $1', [id]), activeCounts(db)]);
      return { event: { ...event, activeListings: counts.get(id) ?? 0 } };
    },
  );

  // Объявления для модерации: активные или снятые модератором
  app.get(
    '/api/admin/listings',
    {
      preHandler: requireAdmin,
      schema: { querystring: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'removed'] } } } },
    },
    async (req) => {
      const rows = await db.query(
        `${LISTING_SELECT.replace('SELECT l.*,', 'SELECT l.*, u.username, u.blocked_at, u.blocked_reason,')}
         WHERE l.status = $1 ORDER BY l.created_at DESC LIMIT 300`,
        [req.query.status ?? 'active'],
      );
      return {
        listings: rows.map((r) => {
          const offer = toOffer(r, req.user.id);
          return {
            ...offer,
            removedReason: r.removed_reason,
            seller: {
              ...offer.seller,
              id: Number(r.seller_id),
              username: r.username,
              blocked: Boolean(r.blocked_at),
              blockedReason: r.blocked_reason,
            },
          };
        }),
      };
    },
  );

  app.post(
    '/api/admin/listings/:id/remove',
    {
      preHandler: requireAdmin,
      schema: { params: { type: 'object', properties: { id: { type: 'string', pattern: UUID } } }, body: reasonBody },
    },
    async (req) => {
      const reason = req.body.reason.trim();
      const [row] = await db.query(
        `UPDATE listings SET status = 'removed', withdrawn_at = now(), removed_reason = $2, removed_by = $3
         WHERE id = $1 AND status = 'active' RETURNING id`,
        [req.params.id, reason, req.user.id],
      );
      if (!row) throw new HttpError(404, 'listing_not_found', 'Активное объявление не найдено');
      await logAction(db, req.user.id, 'listing_remove', 'listing', row.id, reason);
      return { ok: true };
    },
  );

  const userParams = { type: 'object', properties: { id: { type: 'string', pattern: '^\\d{1,15}$' } } };

  // Блокировка продавца: продавать больше нельзя, все его активные объявления снимаются
  app.post(
    '/api/admin/users/:id/block',
    { preHandler: requireAdmin, schema: { params: userParams, body: reasonBody } },
    async (req) => {
      const userId = Number(req.params.id);
      const reason = req.body.reason.trim();
      if (userId === Number(req.user.id)) throw new HttpError(400, 'self_block', 'Себя заблокировать нельзя');
      const removed = await db.tx(async (t) => {
        const [user] = await t.query(
          `UPDATE users SET blocked_at = now(), blocked_reason = $2 WHERE id = $1 RETURNING id`,
          [userId, reason],
        );
        if (!user) throw new HttpError(404, 'user_not_found', 'Пользователь не найден');
        const rows = await t.query(
          `UPDATE listings SET status = 'removed', withdrawn_at = now(), removed_reason = $2, removed_by = $3
           WHERE seller_id = $1 AND status = 'active' RETURNING id`,
          [userId, `Продавец заблокирован: ${reason}`, req.user.id],
        );
        await logAction(t, req.user.id, 'user_block', 'user', userId, reason);
        return rows.length;
      });
      return { ok: true, removedListings: removed };
    },
  );

  // Разблокировка возвращает право продавать; снятые объявления не восстанавливаются
  app.post('/api/admin/users/:id/unblock', { preHandler: requireAdmin, schema: { params: userParams } }, async (req) => {
    const [user] = await db.query(
      `UPDATE users SET blocked_at = NULL, blocked_reason = NULL WHERE id = $1 RETURNING id`,
      [Number(req.params.id)],
    );
    if (!user) throw new HttpError(404, 'user_not_found', 'Пользователь не найден');
    await logAction(db, req.user.id, 'user_unblock', 'user', user.id);
    return { ok: true };
  });
}
