// Проверка загруженного билета.
// Реально: тип и размер файла. Имитация: «распознавание» ИИ — данные детерминированно
// выводятся из имени/размера файла и лотов события. С бэкендом здесь будет загрузка
// файла на сервер, чтение штрихкода и сверка с API организатора.
import { ZONES } from '@/data/mockData';

export const MAX_FILE_MB = 10;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_EXT = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;

export const CHECK_STEPS = [
  'Читаем штрихкод',
  'Сверяем билет с базой организатора',
  'Проверяем номинал',
  'Ищем дубли на других площадках',
];

// Зоны без мест — свободная рассадка
const GENERAL_ADMISSION = new Set(['dance', 'fan']);

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

// onStep(i) вызывается перед каждым шагом — для анимации чек-листа
export async function analyzeTicket(file, eventOffers, onStep) {
  for (let i = 0; i < CHECK_STEPS.length; i++) {
    onStep?.(i);
    await delay(650 + (i % 2) * 300);
  }
  onStep?.(CHECK_STEPS.length);

  const h = hash(`${file.name}:${file.size}:${file.lastModified}`);
  const zones = [...new Set(eventOffers.map((o) => o.zone))];
  const zone = zones[h % zones.length];
  // Номинал берём с лотов той же зоны — продавец его не редактирует (защита от накрутки)
  const nominal = Math.max(...eventOffers.filter((o) => o.zone === zone).map((o) => o.nominal));
  const seated = !GENERAL_ADMISSION.has(zone);

  return {
    zone,
    zoneLabel: ZONES[zone],
    seated,
    sector: seated ? (zone === 'stands' ? `A${1 + (h % 12)}` : ZONES[zone]) : '',
    row: seated ? String(1 + ((h >>> 4) % 25)) : '',
    seat: seated ? String(1 + ((h >>> 9) % 40)) : '',
    nominal,
    barcode: String(h).padStart(10, '0').slice(-10),
    fileKind: file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'PDF' : 'Фото билета',
  };
}

// Заголовок лота так же, как у демо-лотов: «Сектор A4, Ряд 7, Место 18» или «Танцпол»
export function listingTitle({ seated, zoneLabel, sector, row, seat }) {
  if (!seated) return zoneLabel;
  const prefix = sector && sector !== zoneLabel ? `Сектор ${sector}` : zoneLabel;
  return [prefix, row && `Ряд ${row}`, seat && `Место ${seat}`].filter(Boolean).join(', ');
}
