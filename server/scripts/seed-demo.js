// npm run seed:demo — добавить демо-события в локальную базу (уже добавленные пропускаются)
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { seedCatalog } from '../src/seed.js';

const config = loadConfig();
if (config.production) throw new Error('Демо-события не для production: события заводит администратор');
const db = await openDb({ databaseUrl: config.databaseUrl });
await migrate(db, console.log);
console.log(`Демо-событий добавлено: ${await seedCatalog(db)}`);
await db.close();
