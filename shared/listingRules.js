// Правила объявлений — общие для приложения и сервера.
// Сервер — источник истины: приложение повторяет проверки только ради мгновенных подсказок.
//
// Честно о проверке билета: настоящей сверки штрихкода с организатором пока нет.
// Продавец сам выбирает зону и места; номинал берётся из прайса зоны (не от продавца),
// сервер проверяет формат файла, дубли файла и подтверждённый номер продавца.
import { ZONES, offers } from './catalog.js';

export const MAX_FILE_MB = 10;
export const MIN_PRICE = 100;
export const MAX_QUANTITY = 4;
// Новый продавец (нет завершённых продаж) держит не больше стольких активных объявлений
export const NEW_SELLER_ACTIVE_LIMIT = 3;
const SEAT_MAX_LEN = 8;

// Зоны без мест — свободная рассадка
const GENERAL_ADMISSION = new Set(['dance', 'fan']);
// Зоны, где кроме ряда и места нужен сектор
const WITH_SECTOR = new Set(['stands']);

// Прайс зон события: [{ id, label, nominal, seated, needsSector }].
// В бете его заводит администратор (таблица event_zones); здесь — прайс демо-каталога:
// максимальный номинал зоны среди демо-лотов. Им же заполняет базу `npm run seed:demo`.
export function catalogZones(eventId) {
  const byZone = new Map();
  for (const o of offers) {
    if (o.eventId !== eventId) continue;
    byZone.set(o.zone, Math.max(byZone.get(o.zone) ?? 0, o.nominal));
  }
  return [...byZone].map(([id, nominal]) => ({
    id,
    label: ZONES[id],
    nominal,
    seated: !GENERAL_ADMISSION.has(id),
    needsSector: WITH_SECTOR.has(id),
  }));
}

export const findZone = (zones, zoneId) => zones.find((z) => z.id === zoneId) ?? null;

// Ошибка в местах или null. Для свободной рассадки места не нужны.
export function seatsError(zone, { sector = '', row = '', seat = '' } = {}) {
  if (!zone.seated) return null;
  const fields = [['Ряд', row], ['Место', seat], ...(zone.needsSector ? [['Сектор', sector]] : [])];
  for (const [name, value] of fields) {
    const v = String(value).trim();
    if (!v) return `Укажите: ${name.toLowerCase()}`;
    if (v.length > SEAT_MAX_LEN) return `${name}: не длиннее ${SEAT_MAX_LEN} символов`;
  }
  return null;
}

// Заголовок лота так же, как у демо-лотов: «Сектор A4, Ряд 7, Место 18» или «Танцпол»
export function listingTitle(zone, { sector = '', row = '', seat = '' } = {}) {
  if (!zone.seated) return zone.label;
  const prefix = zone.needsSector && sector.trim() ? `Сектор ${sector.trim()}` : zone.label;
  return [prefix, row.trim() && `Ряд ${row.trim()}`, seat.trim() && `Место ${seat.trim()}`].filter(Boolean).join(', ');
}

// Ошибка цены или null — одна формулировка и в приложении, и в ответе сервера
export function priceError(price, nominal) {
  if (!Number.isInteger(price)) return 'Цена должна быть целым числом рублей';
  if (price < MIN_PRICE) return `Минимальная цена — ${MIN_PRICE} ₽`;
  if (price > nominal) return 'Выше номинала продавать нельзя';
  return null;
}
