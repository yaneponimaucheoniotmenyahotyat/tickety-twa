import { randomBytes } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { signInitData } from '../src/telegramAuth.js';

export const TOKEN = '123456:TEST-token-not-real';

// Приложение на чистой базе в памяти, файлы на диск не пишутся
export async function setup() {
  const db = await openDb({ dataDir: 'memory://' });
  await migrate(db);
  const app = await buildApp({ config: loadConfig({ BOT_TOKEN: TOKEN, UPLOAD_DIR: 'off' }), db });
  return { app, db, close: async () => (await app.close(), await db.close()) };
}

export const tma = (user) =>
  `tma ${signInitData({ user, auth_date: Math.floor(Date.now() / 1000), query_id: 'q1' }, TOKEN)}`;

export const users = {
  alice: { id: 1001, first_name: 'Алиса', last_name: 'Иванова' },
  bob: { id: 1002, first_name: 'Борис' },
};

// Настоящие сигнатуры форматов + случайный хвост, чтобы каждый файл был «другим билетом»
export const files = {
  pdf: () => ({ name: 'ticket.pdf', type: 'application/pdf', data: Buffer.concat([Buffer.from('%PDF-1.7\n'), randomBytes(256)]) }),
  png: () => ({
    name: 'ticket.png',
    type: 'image/png',
    data: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(256)]),
  }),
  heic: () => ({
    name: 'IMG_0001.HEIC',
    type: '', // iOS часто не сообщает тип
    data: Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), randomBytes(256)]),
  }),
  fakePdf: () => ({ name: 'ticket.pdf', type: 'application/pdf', data: Buffer.from('это просто текст, переименованный в pdf') }),
};

export function multipart(fields, file) {
  const boundary = `----tickety${randomBytes(8).toString('hex')}`;
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
          `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
      ),
      file.data,
      Buffer.from('\r\n'),
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
