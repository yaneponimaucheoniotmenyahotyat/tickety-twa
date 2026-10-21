// Миграции — пронумерованные SQL-файлы из server/migrations, каждый применяется один раз.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../migrations', import.meta.url));

export async function migrate(db, log = () => {}) {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const done = new Set((await db.query('SELECT name FROM schema_migrations')).map((r) => r.name));
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(`${DIR}/${file}`, 'utf8');
    // Миграция и отметка о ней — в одной транзакции: упала посередине — не применилась вовсе
    await db.exec(`BEGIN;\n${sql}\nINSERT INTO schema_migrations (name) VALUES ('${file}');\nCOMMIT;`);
    log(`migration applied: ${file}`);
  }
}
