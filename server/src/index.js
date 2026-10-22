import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { migrate } from './migrate.js';
import { expireReservations, releaseDue } from './orders.js';

const config = loadConfig();
const db = await openDb({ databaseUrl: config.databaseUrl });
const app = await buildApp({ config, db, logger: { level: config.production ? 'info' : 'debug' } });

// Локальная база PGlite не переживает аварийного убийства процесса во время записи
// (так однажды и потеряли данные). Поэтому при каждом запуске — снимок в .backups/, последние 7.
// Восстановление: new PGlite(dataDir, { loadDataDir: <файл .tar.gz> }) в пустую папку.
if (db.dump) {
  const dir = fileURLToPath(new URL('../.backups', import.meta.url));
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await writeFile(`${dir}/pglite-${stamp}.tar.gz`, await db.dump());
  const old = (await readdir(dir)).filter((f) => f.startsWith('pglite-')).sort().slice(0, -7);
  for (const f of old) await rm(`${dir}/${f}`);
  app.log.info(`снимок базы: .backups/pglite-${stamp}.tar.gz`);
}

await migrate(db, (msg) => app.log.info(msg));
if (!config.botToken) app.log.warn('BOT_TOKEN не задан: вход через Telegram работать не будет (заполните server/.env)');
if (config.allowDevAuth) app.log.warn('ALLOW_DEV_AUTH=1: принимается заголовок «Authorization: dev <id>» — только для локальной разработки');

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await app.close();
  await db.close(); // база закрывается аккуратно — журнал не повреждается
  process.exit(0);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, shutdown);

// На Windows «убить процесс» не даёт серверу закрыть базу. Безопасная остановка — npm run stop:
// он читает одноразовый ключ из .data/.stop-token и просит сервер завершиться сам.
// Снаружи не достать: туннель пересылает только /api, а ключ лежит лишь на этом компьютере.
if (db.dump) {
  const token = randomBytes(24).toString('hex');
  const tokenFile = fileURLToPath(new URL('../.data/.stop-token', import.meta.url));
  await writeFile(tokenFile, token);
  app.post('/__local/stop', async (req, reply) => {
    const given = Buffer.from(String(req.headers['x-stop-token'] ?? ''));
    if (given.length !== token.length || !timingSafeEqual(given, Buffer.from(token))) {
      return reply.code(404).send({ error: 'not_found' });
    }
    setImmediate(() => void rm(tokenFile, { force: true }).then(shutdown));
    return { stopping: true };
  });
}

// На хостинге слушаем все интерфейсы, локально — только этот компьютер
await app.listen({ port: config.port, host: config.production ? '0.0.0.0' : '127.0.0.1' });
app.log.info(`база: ${db.kind}`);

// Раз в минуту: снять неоплаченные брони и отдать продавцам деньги, срок удержания которых истёк
const settle = setInterval(async () => {
  try {
    await expireReservations(db);
    await releaseDue(db, app.notify);
  } catch (err) {
    app.log.error(err, 'не удалось провести расчёты по заказам');
  }
}, 60_000);
settle.unref();
