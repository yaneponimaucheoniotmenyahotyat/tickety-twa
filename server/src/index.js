import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { migrate } from './migrate.js';

const config = loadConfig();
const db = await openDb({ databaseUrl: config.databaseUrl });
const app = await buildApp({ config, db, logger: { level: config.production ? 'info' : 'debug' } });

await migrate(db, (msg) => app.log.info(msg));
if (!config.botToken) app.log.warn('BOT_TOKEN не задан: вход через Telegram работать не будет (заполните server/.env)');
if (config.allowDevAuth) app.log.warn('ALLOW_DEV_AUTH=1: принимается заголовок «Authorization: dev <id>» — только для локальной разработки');

// На хостинге слушаем все интерфейсы, локально — только этот компьютер
await app.listen({ port: config.port, host: config.production ? '0.0.0.0' : '127.0.0.1' });
app.log.info(`база: ${db.kind}`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close();
    await db.close();
    process.exit(0);
  });
}
