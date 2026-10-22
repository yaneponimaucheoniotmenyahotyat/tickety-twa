// Проверка загруженного билета на стороне приложения.
// Честно о том, что проверяется: формат файла и (с сервером) дубли файла на Tickety.
// Штрихкод с организатором не сверяется — зону и места указывает продавец,
// номинал берётся из прайса зоны.
import { MAX_FILE_MB } from '../../shared/listingRules.js';
import { apiEnabled } from './api';

export { MAX_FILE_MB };
export { findZone, listingTitle, MIN_PRICE, priceError, seatsError } from '../../shared/listingRules.js';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_EXT = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;

// Шаги чек-листа — ровно то, что делается на самом деле
export const CHECK_STEPS = apiEnabled
  ? ['Проверяем формат файла', 'Ищем такой же билет на Tickety']
  : ['Проверяем формат файла'];

export const fileKindOf = (file) => (file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'PDF' : 'Фото билета');

// Быстрая проверка до загрузки — чтобы не гонять заведомо неподходящий файл по сети.
// Окончательное решение (формат по содержимому, дубли) принимает сервер.
export function validateFile(file) {
  if (!file) return 'Файл не выбран';
  // iOS отдаёт HEIC с пустым type — тогда смотрим на расширение
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
    return 'Нужен PDF или фото билета (JPG, PNG, HEIC)';
  }
  if (file.size === 0) return 'Файл пустой — попробуйте выбрать его ещё раз';
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `Файл больше ${MAX_FILE_MB} МБ — сожмите его или сделайте скриншот`;
  return null;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Анимация чек-листа идёт параллельно с работой (work); результат — когда закончилось и то и другое
export async function runCheckAnimation(work, onStep) {
  const animation = (async () => {
    for (let i = 0; i < CHECK_STEPS.length; i++) {
      onStep?.(i);
      await delay(600);
    }
  })();
  const [result] = await Promise.all([work, animation]);
  onStep?.(CHECK_STEPS.length);
  return result;
}
