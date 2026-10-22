// Поиск кода входа на билете: QR, Aztec, PDF417, DataMatrix или линейный штрихкод.
// Фото — декодируем в пиксели; PDF — рендерим первые страницы (код часто нарисован вектором).
//
// Честно о проверке: наличие кода не доказывает, что билет настоящий — код мог нарисовать
// кто угодно. Зато картинка без кода точно не билет, а содержимое кода — отпечаток билета:
// тот же билет не выставить второй раз даже другим скриншотом.
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readBarcodes } from 'zxing-wasm/reader';
import { HttpError } from './errors.js';

// Без EAN/UPC: они есть на любой упаковке из интернета и на билеты не похожи
const FORMATS = ['QRCode', 'MicroQRCode', 'Aztec', 'PDF417', 'DataMatrix', 'Code128', 'ITF'];
const PDF_PAGES = 4;
const PDF_SCALE = 2; // A4 → ~1190×1684: мелкий QR ещё читается
const MAX_SIDE = 4096; // огромные фото уменьшаем — память сервера не бесконечна
const TIMEOUT_MS = 15_000;

export const codeLabel = (format) =>
  /QR/.test(format) ? 'QR-код' : format === 'Aztec' ? 'Aztec-код' : 'штрихкод';

// Отпечаток кода. Само содержимое не храним: по нему можно пройти на событие.
export const codeHash = (c) => createHash('sha256').update(`${c.format}:${c.text}`).digest('hex');

async function decode(imageData) {
  const found = await readBarcodes(imageData, { formats: FORMATS, tryHarder: true, maxNumberOfSymbols: 16 });
  return found.filter((c) => c.isValid && c.text).map((c) => ({ format: c.format, text: c.text }));
}

function pixelsOf(image) {
  const k = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * k));
  const h = Math.max(1, Math.round(image.height * k));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // прозрачный PNG: чёрный фон «съел» бы тёмный код
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

async function fromImage(buf) {
  let image;
  try {
    image = await loadImage(buf);
  } catch {
    throw new HttpError(422, 'unreadable_file', 'Не получилось открыть картинку — сделайте скриншот билета и загрузите его');
  }
  return decode(pixelsOf(image));
}

async function fromPdf(buf) {
  let task;
  let pdf;
  try {
    task = getDocument({
      data: new Uint8Array(buf),
      isEvalSupported: false, // никакого исполнения кода из PDF
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    });
    pdf = await task.promise;
  } catch {
    await task?.destroy();
    throw new HttpError(422, 'unreadable_file', 'PDF повреждён или защищён паролем — загрузите файл от организатора без пароля');
  }
  try {
    const codes = [];
    for (let n = 1; n <= Math.min(pdf.numPages, PDF_PAGES); n += 1) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: PDF_SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      codes.push(...(await decode(ctx.getImageData(0, 0, canvas.width, canvas.height))));
    }
    return codes;
  } finally {
    await task.destroy(); // освобождает воркер и память документа
  }
}

// Коды билета без повторов. Нет ни одного — 422: это не билет (или код не читается).
export async function findCodes(buf, kind) {
  if (kind === 'heic') {
    // HEIC (фото iPhone) сервер не декодирует; приложение само переводит его в JPEG, если может
    throw new HttpError(415, 'heic', 'Фото в формате HEIC не читается — сделайте скриншот билета и загрузите его');
  }
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new HttpError(422, 'decode_timeout', 'Файл слишком сложный — загрузите скриншот билета с кодом')),
      TIMEOUT_MS,
    );
  });
  try {
    const codes = await Promise.race([kind === 'pdf' ? fromPdf(buf) : fromImage(buf), timeout]);
    const unique = [...new Map(codes.map((c) => [codeHash(c), c])).values()];
    if (!unique.length) {
      throw new HttpError(
        422,
        'no_code',
        'На файле не нашли QR-код или штрихкод для входа. Загрузите билет целиком — PDF от организатора или чёткий скриншот, где виден код',
      );
    }
    return unique;
  } finally {
    clearTimeout(timer);
  }
}
