// npm run test-tickets [папка] — образцы «билетов» для ручной проверки загрузки с телефона.
// Это не билеты: на каждом крупно написано «ОБРАЗЕЦ», код — случайная строка TICKETY-TEST-….
//
//   1-bilet.pdf            PDF с одним QR-кодом (как от организатора)
//   2-skrinshot-1.png      скриншот того же билета — должен попасть в дубли, пока 1 в продаже
//   3-dva-bileta.pdf       два билета в одном PDF — можно выставить 2
//   4-shtrihkod.png        билет с линейным штрихкодом (Code128)
//   5-ne-bilet.jpg         обычная картинка без кода — должна быть отклонена
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { writeBarcode } from 'zxing-wasm/writer';

const out = resolve(process.argv[2] ?? 'test-tickets');
const code = () => `TICKETY-TEST-${randomBytes(6).toString('hex').toUpperCase()}`;

async function barcode(text, format) {
  const { image, error } = await writeBarcode(text, { format, scale: format === 'QRCode' ? 10 : 4 });
  if (error) throw new Error(error);
  return loadImage(Buffer.from(await image.arrayBuffer()));
}

// Билет как картинка: шапка, событие, места, код. w×h — размер в пикселях.
async function ticketImage({ text, format = 'QRCode', seat, w = 1170, h = 1800 }) {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1B2F5D';
  ctx.fillRect(0, 0, w, 260);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Arial';
  ctx.fillText('ЭЛЕКТРОННЫЙ БИЛЕТ', 70, 150);
  ctx.font = '36px Arial';
  ctx.fillText('ОБРАЗЕЦ ДЛЯ ПРОВЕРКИ TICKETY — НЕ ДЛЯ ВХОДА', 70, 215);

  ctx.fillStyle = '#111111';
  ctx.font = 'bold 56px Arial';
  ctx.fillText('Мумий Тролль — Live', 70, 380);
  ctx.font = '40px Arial';
  ctx.fillStyle = '#444444';
  ctx.fillText('14 февраля 2027, 19:30 • VK Stadium, Москва', 70, 450);
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 48px Arial';
  ctx.fillText(seat, 70, 560);

  const img = await barcode(text, format);
  const size = format === 'QRCode' ? 640 : null;
  const bw = size ?? Math.min(w - 140, img.width * 2);
  const bh = size ?? 260;
  ctx.drawImage(img, (w - bw) / 2, 660, bw, bh);
  ctx.font = '34px Arial';
  ctx.fillStyle = '#666666';
  ctx.fillText('Покажите код на входе', (w - ctx.measureText('Покажите код на входе').width) / 2, 660 + bh + 70);

  // Крупная пометка поверх: образец
  ctx.save();
  ctx.translate(w / 2, h - 300);
  ctx.rotate(-0.25);
  ctx.font = 'bold 150px Arial';
  ctx.fillStyle = 'rgba(200, 38, 30, 0.18)';
  ctx.fillText('ОБРАЗЕЦ', -ctx.measureText('ОБРАЗЕЦ').width / 2, 0);
  ctx.restore();
  return c;
}

async function pdfOf(canvases) {
  const doc = await PDFDocument.create();
  for (const c of canvases) {
    const png = await doc.embedPng(await c.encode('png'));
    const page = doc.addPage([595, (595 * c.height) / c.width]);
    page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  return Buffer.from(await doc.save());
}

await mkdir(out, { recursive: true });
const one = code();
const seatA = 'Сектор 108, Ряд 4, Место 9';

await writeFile(join(out, '1-bilet.pdf'), await pdfOf([await ticketImage({ text: one, seat: seatA })]));
// «Скриншот с телефона» — тот же код, другой файл и размер
const shot = await ticketImage({ text: one, seat: seatA, w: 1170, h: 2532 });
await writeFile(join(out, '2-skrinshot-1.png'), await shot.encode('png'));
await writeFile(
  join(out, '3-dva-bileta.pdf'),
  await pdfOf([
    await ticketImage({ text: code(), seat: 'Танцпол • билет 1 из 2' }),
    await ticketImage({ text: code(), seat: 'Танцпол • билет 2 из 2' }),
  ]),
);
const linear = await ticketImage({ text: code().slice(0, 24), format: 'Code128', seat: 'Трибуны, Ряд 12, Место 3' });
await writeFile(join(out, '4-shtrihkod.png'), await linear.encode('png'));

// Обычная картинка «из интернета»
const pic = createCanvas(1200, 800);
const p = pic.getContext('2d');
const g = p.createLinearGradient(0, 0, 1200, 800);
g.addColorStop(0, '#140B1F');
g.addColorStop(0.5, '#E0245E');
g.addColorStop(1, '#2D6BFF');
p.fillStyle = g;
p.fillRect(0, 0, 1200, 800);
p.fillStyle = '#ffffff';
p.font = 'bold 96px Arial';
p.fillText('КОНЦЕРТ!', 340, 430);
await writeFile(join(out, '5-ne-bilet.jpg'), await pic.encode('jpeg', 90));

console.log(`Образцы билетов: ${out}`);
