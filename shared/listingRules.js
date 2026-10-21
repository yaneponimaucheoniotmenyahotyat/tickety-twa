// Правила объявлений и «распознавание» билета — общие для приложения и сервера.
// Сервер — источник истины: приложение повторяет проверки только ради мгновенных подсказок.
import { ZONES } from './catalog.js';

export const MAX_FILE_MB = 10;
export const MIN_PRICE = 100;
export const MAX_QUANTITY = 4;
// Новый продавец (нет завершённых продаж) держит не больше стольких активных объявлений
export const NEW_SELLER_ACTIVE_LIMIT = 3;

// Зоны без мест — свободная рассадка
const GENERAL_ADMISSION = new Set(['dance', 'fan']);

// Имитация ИИ: данные билета детерминированно выводятся из числа seed
// (на сервере — из SHA-256 содержимого файла) и демо-лотов события.
// Номинал берётся с лотов той же зоны — продавец его не задаёт.
export function recognizeTicket(seed, eventOffers, fileKind) {
  const h = seed >>> 0;
  const zones = [...new Set(eventOffers.map((o) => o.zone))];
  const zone = zones[h % zones.length];
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
    fileKind,
  };
}

// Заголовок лота так же, как у демо-лотов: «Сектор A4, Ряд 7, Место 18» или «Танцпол»
export function listingTitle({ seated, zoneLabel, sector, row, seat }) {
  if (!seated) return zoneLabel;
  const prefix = sector && sector !== zoneLabel ? `Сектор ${sector}` : zoneLabel;
  return [prefix, row && `Ряд ${row}`, seat && `Место ${seat}`].filter(Boolean).join(', ');
}

// Ошибка цены или null — одна формулировка и в приложении, и в ответе сервера
export function priceError(price, nominal) {
  if (!Number.isInteger(price)) return 'Цена должна быть целым числом рублей';
  if (price < MIN_PRICE) return `Минимальная цена — ${MIN_PRICE} ₽`;
  if (price > nominal) return 'Выше номинала продавать нельзя';
  return null;
}
