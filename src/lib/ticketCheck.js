// Проверка загруженного билета на стороне приложения.
// С сервером: файл уходит на сервер, там определяется формат по содержимому, ищутся дубли
// и вычисляется номинал. Без сервера (локальный режим) — та же «распознавалка» из shared/,
// но данные выводятся из имени и размера файла.
import { MAX_FILE_MB, recognizeTicket } from '../../shared/listingRules.js';

export { MAX_FILE_MB };
export { listingTitle, MIN_PRICE, priceError } from '../../shared/listingRules.js';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_EXT = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;

export const CHECK_STEPS = [
  'Читаем штрихкод',
  'Сверяем билет с базой организатора',
  'Проверяем номинал',
  'Ищем дубли на других площадках',
];

// Быстрая проверка до загрузки — чтобы не гонять заведомо неподходящий файл по сети.
// Окончательное решение принимает сервер.
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

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Анимация чек-листа «Проверка Tickety AI»: шаги идут параллельно с работой (work),
// результат показывается, когда закончилось и то и другое.
export async function runCheckAnimation(work, onStep) {
  const animation = (async () => {
    for (let i = 0; i < CHECK_STEPS.length; i++) {
      onStep?.(i);
      await delay(650 + (i % 2) * 300);
    }
  })();
  const [result] = await Promise.all([work, animation]);
  onStep?.(CHECK_STEPS.length);
  return result;
}

// Локальный режим (сервер не настроен)
export function analyzeTicketLocally(file, eventOffers) {
  const fileKind = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'PDF' : 'Фото билета';
  return recognizeTicket(hash(`${file.name}:${file.size}:${file.lastModified}`), eventOffers, fileKind);
}
