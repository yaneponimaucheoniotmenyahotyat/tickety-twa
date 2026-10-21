// Единый интерфейс базы: db.query(sql, params) → rows, db.exec(sql), db.close().
// Есть DATABASE_URL — настоящий PostgreSQL (pg). Нет — PGlite: тот же PostgreSQL,
// но внутри процесса Node, без установки. Для тестов — в памяти.
import { fileURLToPath } from 'node:url';

export async function openDb({ databaseUrl, dataDir } = {}) {
  if (databaseUrl) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
    return {
      kind: 'postgres',
      query: async (sql, params) => (await pool.query(sql, params)).rows,
      exec: async (sql) => {
        await pool.query(sql);
      },
      close: () => pool.end(),
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const dir = dataDir ?? fileURLToPath(new URL('../.data', import.meta.url));
  const lite = new PGlite(dir);
  await lite.waitReady;
  return {
    kind: dir.startsWith('memory://') ? 'pglite-memory' : 'pglite',
    query: async (sql, params) => (await lite.query(sql, params)).rows,
    exec: async (sql) => {
      await lite.exec(sql);
    },
    close: () => lite.close(),
  };
}
