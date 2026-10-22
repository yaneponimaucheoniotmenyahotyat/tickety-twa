// Демо-события из shared/catalog.js → база. Только для локальной разработки и тестов:
// на сервере беты события заводит администратор по официальному прайсу.
import { events } from '../../shared/catalog.js';
import { catalogZones } from '../../shared/listingRules.js';

export async function seedCatalog(db) {
  let added = 0;
  for (const e of events) {
    const [row] = await db.query(
      `INSERT INTO events (id, title, category, tags, starts_at, doors_open, venue, city, address, description, cover, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [e.id, e.title, e.category, e.tags, e.date, e.doorsOpen, e.venue, e.city, e.address, e.description, e.cover, e.image],
    );
    if (!row) continue;
    added += 1;
    for (const [position, z] of catalogZones(e.id).entries()) {
      await db.query(
        `INSERT INTO event_zones (event_id, id, label, nominal, seated, needs_sector, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [e.id, z.id, z.label, z.nominal, z.seated, z.needsSector, position],
      );
    }
  }
  return added;
}
