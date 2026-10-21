import { getOffer } from '@/data/mockData';

// Модель купленного билета и жизненный цикл эскроу-сделки.
// Билет хранит снимок события: история покупок не ломается, если событие снимут с продажи.

// Демо: продавец «переоформляет» билет 20 секунд. В проде статус придёт от бэкенда.
export const TRANSFER_MS = 20_000;
// Проход считается состоявшимся через 4 часа после начала события
const EVENT_DURATION_MS = 4 * 60 * 60 * 1000;
// QR перевыпускается каждые 30 секунд — скриншот кода перепродать нельзя
export const QR_ROTATE_S = 30;

export const STATUS = {
  transfer: { label: 'Переоформление', tone: 'brand' },
  ready: { label: 'Готов к проходу', tone: 'success' },
  used: { label: 'Проход выполнен', tone: 'neutral' },
};

export function ticketStatus(ticket, now = Date.now()) {
  if (new Date(ticket.event.date).getTime() + EVENT_DURATION_MS < now) return 'used';
  if (now - ticket.purchasedAt < TRANSFER_MS) return 'transfer';
  return 'ready';
}

export const isPast = (ticket, now = Date.now()) => ticketStatus(ticket, now) === 'used';

// TKT-8F2K-Q7LM: без 0/O/1/I, чтобы код можно было продиктовать контролёру
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `TKT-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function createTicket({ event, offer, total, method }) {
  const { id, title, date, doorsOpen, venue, city, address, cover, image } = event;
  return {
    id: `t-${Date.now().toString(36)}`,
    code: makeCode(),
    offerId: offer.id,
    event: { id, title, date, doorsOpen, venue, city, address, cover, image },
    seat: offer.title,
    details: offer.details,
    delivery: offer.delivery,
    quantity: offer.quantity,
    price: offer.price,
    nominal: offer.nominal,
    total,
    method,
    seller: offer.seller.name,
    purchasedAt: Date.now(),
  };
}

// Экономия относительно номинала. У билетов, купленных до появления поля nominal,
// номинал берём из исходного лота.
export function ticketSavings(t) {
  const nominal = t.nominal ?? getOffer(t.offerId)?.nominal;
  return nominal ? Math.max(0, nominal - t.price) * t.quantity : 0;
}

// Содержимое QR: код билета + номер 30-секундного окна (сервер проверяет оба)
export const qrPayload = (ticket, windowIndex) => `tickety:v1:${ticket.code}:${windowIndex}`;

// Прошедший билет для демонстрации раздела «Прошедшие»
export const DEMO_TICKETS = [
  {
    id: 't-demo-zemfira',
    code: 'TKT-8F2K-Q7LM',
    offerId: null,
    event: {
      id: 'zemfira-vtb',
      title: 'Земфира — Бордерлайн тур',
      date: '2026-09-14T20:00:00+03:00',
      doorsOpen: '18:30',
      venue: 'ВТБ Арена',
      city: 'Москва',
      address: 'Ленинградский пр., 36',
      cover: ['#1A1030', '#7B5CFF', '#FF4D6D'],
      image: null,
    },
    seat: 'Танцпол',
    details: 'Вход 3 • Электронный билет',
    delivery: 'Apple Wallet + PDF',
    quantity: 1,
    price: 5200,
    nominal: 5500,
    total: 5200,
    method: 'sbp',
    seller: 'Мария С.',
    purchasedAt: Date.parse('2026-08-30T12:00:00+03:00'),
  },
];
