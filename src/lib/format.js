const TZ = 'Europe/Moscow'; // все события в МСК, независимо от часового пояса телефона

const priceFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export const formatPrice = (n) => `${priceFmt.format(n)} ₽`;

// «28 ноября, 19:00»
export function formatEventDate(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: TZ });
  return `${day}, ${formatTime(iso)}`;
}

// «Суббота, 28 ноября 2026»
export function formatLongDate(iso) {
  const s = new Date(iso).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(' г.', '');
}

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

// «Через 38 дней», «Завтра», «Сегодня»
export function formatDaysLeft(iso, now = Date.now()) {
  const days = Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
  if (days <= 0) return 'Сегодня';
  if (days === 1) return 'Завтра';
  return `Через ${days} ${plural(days, ['день', 'дня', 'дней'])}`;
}

// 14:45
export function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// plural(5, ['событие', 'события', 'событий']) → «событий»
export function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const initials = (name) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

// Выгода относительно номинала — подпись под ценой
export function priceNote(price, nominal) {
  if (price >= nominal) return { text: 'Честная перепродажа 1:1', tone: 'brand' };
  const diff = nominal - price;
  const pct = Math.round((diff / nominal) * 100);
  if (pct >= 10) return { text: `Скидка ${pct}% от номинала`, tone: 'success' };
  return { text: `Выгода ${formatPrice(diff)} от номинала`, tone: 'success' };
}
