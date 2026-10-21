// Файлы билетов: формат определяется по первым байтам (сигнатуре), а не по имени или MIME
// от клиента — переименованный .txt в .pdf не пройдёт.
import { createHash } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

export function detectKind(buf) {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp' && HEIC_BRANDS.has(buf.subarray(8, 12).toString('latin1'))) {
    return 'heic';
  }
  return null;
}

export const kindLabel = (kind) => (kind === 'pdf' ? 'PDF' : 'Фото билета');

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Сохраняем по хэшу: один и тот же файл не дублируется на диске.
// uploadDir = null — не сохраняем (тесты). На хостинге нужен постоянный диск или S3.
export async function storeFile(uploadDir, hash, kind, buf) {
  if (!uploadDir) return null;
  await mkdir(uploadDir, { recursive: true });
  const path = join(uploadDir, `${hash}.${kind === 'jpeg' ? 'jpg' : kind}`);
  try {
    await access(path);
  } catch {
    await writeFile(path, buf);
  }
  return path;
}
