// Правила событий и прайса зон — общие для админки (приложение) и сервера.
// Сервер — источник истины; приложение повторяет проверку ради подсказок в форме.

export const EVENT_CATEGORIES = {
  concert: 'Концерт',
  theatre: 'Театр',
  standup: 'Стендап',
  festival: 'Фестиваль',
};

// Как продавец указывает места в зоне
export const SEATING = {
  free: { label: 'Без мест', seated: false, needsSector: false },
  seats: { label: 'Ряд и место', seated: true, needsSector: false },
  sector: { label: 'С сектором', seated: true, needsSector: true }, // сектор, ряд и место
};
export const seatingOf = (zone) => (!zone.seated ? 'free' : zone.needsSector ? 'sector' : 'seats');

// Палитры обложки, пока нет фото: тёмный фон и два «прожектора»
export const COVERS = [
  ['#1B2F5D', '#3D7BFF', '#F47C20'],
  ['#3A2312', '#D9A55B', '#7A1F1F'],
  ['#24140C', '#C9762E', '#3B2A20'],
  ['#140B1F', '#E0245E', '#2D6BFF'],
  ['#0E2A23', '#C8A951', '#7C1D2B'],
  ['#071C2C', '#00B3A6', '#FF5C8A'],
];

export const MAX_ZONES = 12;
export const MAX_NOMINAL = 1_000_000;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const text = (v) => (typeof v === 'string' ? v.trim() : '');

// Ошибка в событии или null. Одна формулировка и в форме, и в ответе сервера.
export function eventError(e) {
  if (!text(e.title)) return 'Укажите название';
  if (!EVENT_CATEGORIES[e.category]) return 'Выберите категорию';
  if (!e.date || Number.isNaN(new Date(e.date).getTime())) return 'Укажите дату и время начала';
  if (e.doorsOpen && !TIME.test(e.doorsOpen)) return 'Время входа — в формате 18:30';
  if (!text(e.venue)) return 'Укажите площадку';
  if (!text(e.city)) return 'Укажите город';
  if (!Array.isArray(e.cover) || e.cover.length !== 3 || !e.cover.every((c) => HEX.test(c))) return 'Выберите обложку';
  if (e.sourceUrl && !/^https:\/\/\S+$/.test(e.sourceUrl)) return 'Ссылка на прайс должна начинаться с https://';

  const zones = e.zones ?? [];
  if (!zones.length) return 'Добавьте хотя бы одну зону с номиналом';
  if (zones.length > MAX_ZONES) return `Не больше ${MAX_ZONES} зон`;
  const labels = new Set();
  for (const z of zones) {
    const label = text(z.label);
    if (!label) return 'У каждой зоны должно быть название';
    if (labels.has(label.toLowerCase())) return `Зона «${label}» указана дважды`;
    labels.add(label.toLowerCase());
    if (!Number.isInteger(z.nominal) || z.nominal < 100 || z.nominal > MAX_NOMINAL) {
      return `Номинал зоны «${label}» — целое число от 100 до ${MAX_NOMINAL.toLocaleString('ru-RU')} ₽`;
    }
    if (!SEATING[z.seating]) return `Выберите, как указываются места в зоне «${label}»`;
  }
  return null;
}
