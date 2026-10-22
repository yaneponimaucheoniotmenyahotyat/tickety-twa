// События и прайс зон из базы. Публичный каталог — только опубликованные события;
// скрытые видит и правит администратор (admin.js).
import { HttpError } from './errors.js';

// Строка БД + зоны → событие в том же формате, что демо-каталог (shared/catalog.js)
export function toEvent(row, zones = []) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    tags: row.tags ?? [],
    date: new Date(row.starts_at).toISOString(),
    doorsOpen: row.doors_open,
    venue: row.venue,
    city: row.city,
    address: row.address,
    description: row.description,
    cover: row.cover,
    image: row.image,
    sourceUrl: row.source_url,
    status: row.status,
    zones: zones.map((z) => ({
      id: z.id,
      label: z.label,
      nominal: z.nominal,
      seated: z.seated,
      needsSector: z.needs_sector,
    })),
  };
}

// События с зонами одним проходом: where — условие на events (алиас e)
export async function loadEvents(db, where = 'TRUE', params = []) {
  const rows = await db.query(`SELECT e.* FROM events e WHERE ${where} ORDER BY e.starts_at`, params);
  if (!rows.length) return [];
  const zones = await db.query(
    `SELECT * FROM event_zones WHERE event_id = ANY($1) ORDER BY position`,
    [rows.map((r) => r.id)],
  );
  return rows.map((r) => toEvent(r, zones.filter((z) => z.event_id === r.id)));
}

// Событие, на которое можно выставить билет: опубликовано и ещё не прошло
export async function upcomingEvent(db, eventId) {
  const [event] = await loadEvents(db, `e.id = $1 AND e.status = 'published'`, [String(eventId ?? '')]);
  if (!event) throw new HttpError(404, 'event_not_found', 'Такого события нет');
  if (new Date(event.date) <= new Date()) throw new HttpError(400, 'event_past', 'Событие уже прошло');
  return event;
}

export function registerEventRoutes(app, { db }) {
  // Каталог: опубликованные события, прошедшие — ещё неделю (для «Моих билетов» и объявлений)
  app.get('/api/events', async () => ({
    events: await loadEvents(db, `e.status = 'published' AND e.starts_at > now() - interval '7 days'`),
  }));
}
