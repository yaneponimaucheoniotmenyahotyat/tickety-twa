import { randomBytes } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeBarcode } from 'zxing-wasm/writer';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { seedCatalog } from '../src/seed.js';
import { signInitData } from '../src/telegramAuth.js';

export const TOKEN = '123456:TEST-token-not-real';

// Приложение на чистой базе в памяти с демо-событиями, файлы на диск не пишутся
export async function setup({ seed = true } = {}) {
  const db = await openDb({ dataDir: 'memory://' });
  await migrate(db);
  if (seed) await seedCatalog(db);
  const app = await buildApp({ config: loadConfig({ BOT_TOKEN: TOKEN, UPLOAD_DIR: 'off', ADMIN_IDS: String(ADMIN.id) }), db });
  return { app, db, close: async () => (await app.close(), await db.close()) };
}

export const tma = (user) =>
  `tma ${signInitData({ user, auth_date: Math.floor(Date.now() / 1000), query_id: 'q1' }, TOKEN)}`;

// Ответ requestContact, подписанный как будто Telegram
export const signedContact = (user, phone = '79991234567', authDate = Math.floor(Date.now() / 1000)) =>
  signInitData({ contact: { user_id: user.id, phone_number: phone, first_name: user.first_name }, auth_date: authDate }, TOKEN);

export const verifyPhone = (app, user, response = signedContact(user)) =>
  app.inject({ method: 'POST', url: '/api/me/phone', payload: { response }, headers: { authorization: tma(user) } });

export const users = {
  alice: { id: 1001, first_name: 'Алиса', last_name: 'Иванова' },
  bob: { id: 1002, first_name: 'Борис' },
};
// Администратор — из ADMIN_IDS конфигурации тестов
export const ADMIN = { id: 9001, first_name: 'Админ' };

// Содержимое кода билета — у каждого билета своё
export const ticketCode = () => `TKT-${randomBytes(8).toString('hex')}`;

async function codePng(text, format = 'QRCode') {
  const { image, error } = await writeBarcode(text, { format, scale: 4 });
  if (error) throw new Error(error);
  return Buffer.from(await image.arrayBuffer());
}

// Билеты — настоящие файлы с кодом (async: коды рисует zxing)
export const files = {
  png: async (text = ticketCode(), format = 'QRCode') => ({ name: 'ticket.png', type: 'image/png', data: await codePng(text, format) }),
  // PDF «от организатора»: по билету с QR-кодом на странице
  pdf: async (...texts) => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const text of texts.length ? texts : [ticketCode()]) {
      const page = doc.addPage([595, 842]);
      page.drawText('E-TICKET', { x: 60, y: 760, size: 24, font });
      page.drawImage(await doc.embedPng(await codePng(text)), { x: 200, y: 450, width: 160, height: 160 });
    }
    return { name: 'ticket.pdf', type: 'application/pdf', data: Buffer.from(await doc.save()) };
  },
  // Обычная картинка «из интернета» — без кода
  picture: async () => {
    const canvas = createCanvas(600, 400);
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 600, 400);
    g.addColorStop(0, '#3D7BFF');
    g.addColorStop(1, '#F47C20');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 400);
    ctx.fillStyle = '#fff';
    ctx.font = '48px sans-serif';
    ctx.fillText('Концерт!', 180, 220);
    return { name: 'concert.jpg', type: 'image/jpeg', data: await canvas.encode('jpeg') };
  },
  heic: async () => ({
    name: 'IMG_0001.HEIC',
    type: '', // iOS часто не сообщает тип
    data: Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), randomBytes(256)]),
  }),
  fakePdf: async () => ({ name: 'ticket.pdf', type: 'application/pdf', data: Buffer.from('это просто текст, переименованный в pdf') }),
};

export async function multipart(fields, filePromise) {
  const file = await filePromise;
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
