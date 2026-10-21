// Mock-данные MVP. Правило биржи Tickety: цена перепродажи ≤ номинала («Честная цена»).
// Позже этот файл заменяется на API-слой с теми же функциями-селекторами внизу.

export const CITIES = ['Москва', 'Санкт-Петербург'];

export const CATEGORIES = [
  { id: 'all', label: 'Все события' },
  { id: 'concert', label: 'Концерты' },
  { id: 'theatre', label: 'Театр' },
  { id: 'standup', label: 'Стендап' },
  { id: 'festival', label: 'Фестивали' },
];

export const ZONES = {
  fan: 'Фан-зона',
  dance: 'Танцпол',
  stands: 'Трибуны',
  vip: 'VIP',
  parterre: 'Партер',
  box: 'Ложи',
  amphi: 'Амфитеатр',
  hall: 'Зал',
};

export const PRICE_LIMIT = 20000; // правая граница слайдера «20 000+ ₽»

// cover — три цвета для «сценического» градиента, пока нет фото.
// image — путь в /public, например '/events/basta.jpg'; если задан, перекрывает градиент.
export const events = [
  {
    id: 'basta-luzhniki',
    title: 'Баста — Большой сольный концерт',
    category: 'concert',
    tags: ['Хип-хоп / Рэп', 'Живой звук'],
    date: '2026-11-28T19:00:00+03:00',
    doorsOpen: '17:30',
    venue: 'БСА «Лужники»',
    city: 'Москва',
    address: 'ул. Лужники, 24, стр. 1',
    capacity: 81000,
    description: 'Главное хип-хоп шоу сезона: проверенные билеты от фанатов с гарантией прохода.',
    cover: ['#1B2F5D', '#3D7BFF', '#F47C20'],
    image: null,
    ticketsLeft: 14,
    authenticity: true,
    popularity: 98,
  },
  {
    id: 'swan-lake',
    title: 'Лебединое озеро — П.И. Чайковский',
    category: 'theatre',
    tags: ['Балет', 'Классика'],
    date: '2026-12-12T19:00:00+03:00',
    doorsOpen: '18:00',
    venue: 'Большой театр (Историческая сцена)',
    city: 'Москва',
    address: 'Театральная пл., 1',
    capacity: 1720,
    description: 'Шедевр мировой классики в легендарной постановке Юрия Григоровича.',
    cover: ['#3A2312', '#D9A55B', '#7A1F1F'],
    image: null,
    seatingLabel: 'Партер и Ложи',
    popularity: 91,
  },
  {
    id: 'komissarenko',
    title: 'Стендап: Слава Комиссаренко & гости',
    category: 'standup',
    tags: ['Стендап', '18+'],
    date: '2026-11-30T20:00:00+03:00',
    doorsOpen: '19:00',
    venue: 'StandUp Store Moscow',
    city: 'Москва',
    address: 'ул. Новый Арбат, 21',
    capacity: 300,
    description: 'Новый материал и живая импровизация с залом.',
    cover: ['#24140C', '#C9762E', '#3B2A20'],
    image: null,
    ticketsLeft: 6,
    popularity: 84,
  },
  {
    id: 'shortparis',
    title: 'Shortparis — Презентация нового альбома',
    category: 'concert',
    tags: ['Пост-панк', 'Open air'],
    date: '2027-01-17T20:00:00+03:00',
    doorsOpen: '18:30',
    venue: 'Севкабель Порт',
    city: 'Санкт-Петербург',
    address: 'Кожевенная линия, 40',
    capacity: 5000,
    description: 'Эксклюзивное выступление на берегу Финского залива.',
    cover: ['#140B1F', '#E0245E', '#2D6BFF'],
    image: null,
    eTicket: true,
    popularity: 77,
  },
  {
    id: 'nutcracker-mariinsky',
    title: 'Щелкунчик — Мариинский театр',
    category: 'theatre',
    tags: ['Балет', 'Новогодний'],
    date: '2026-12-28T19:00:00+03:00',
    doorsOpen: '18:00',
    venue: 'Мариинский театр',
    city: 'Санкт-Петербург',
    address: 'Театральная пл., 1',
    capacity: 1625,
    description: 'Главный новогодний спектакль страны — билеты от зрителей по номиналу.',
    cover: ['#0E2A23', '#C8A951', '#7C1D2B'],
    image: null,
    seatingLabel: 'Партер и Ложи',
    popularity: 88,
  },
  {
    id: 'mumiy-troll-vk',
    title: 'Мумий Тролль — Live',
    category: 'concert',
    tags: ['Рок', 'Арена'],
    date: '2027-02-14T19:30:00+03:00',
    doorsOpen: '18:00',
    venue: 'VK Stadium',
    city: 'Москва',
    address: 'Ленинградский пр., 80, корп. 17',
    capacity: 13000,
    description: 'Хиты за 40 лет и новая программа в день всех влюблённых.',
    cover: ['#071C2C', '#00B3A6', '#FF5C8A'],
    image: null,
    ticketsLeft: 22,
    popularity: 80,
  },
];

const sellers = {
  alexey: { name: 'Алексей М.', rating: 4.9, sales: 38 },
  ekaterina: { name: 'Екатерина В.', rating: 5.0, sales: 14 },
  denis: { name: 'Денис К.', rating: 4.8, sales: 21 },
  maria: { name: 'Мария С.', rating: 4.9, sales: 57 },
  igor: { name: 'Игорь П.', rating: 4.7, sales: 9 },
  anna: { name: 'Анна Л.', rating: 5.0, sales: 112 },
};

// quantity — сколько билетов в лоте (места рядом), delivery — формат передачи.
export const offers = [
  // Баста
  { id: 'o-101', eventId: 'basta-luzhniki', zone: 'stands', title: 'Сектор A4, Ряд 7, Место 18', details: 'Вход 2 • Электронный билет (PDF + Wallet)', delivery: 'Apple Wallet + PDF', eTicket: true, nominal: 4000, price: 3800, quantity: 1, verified: true, seller: sellers.alexey },
  { id: 'o-102', eventId: 'basta-luzhniki', zone: 'dance', title: 'Танцевальный партер', details: 'Свободный вход через Северный КПП', delivery: 'PDF', eTicket: true, nominal: 2500, price: 2500, quantity: 2, verified: true, seller: sellers.ekaterina },
  { id: 'o-103', eventId: 'basta-luzhniki', zone: 'vip', title: 'VIP Ложа 12, Ряд 2, Место 4', details: 'VIP Ресторан + Отдельный паркинг P1', delivery: 'Apple Wallet + PDF', eTicket: true, nominal: 12000, price: 9500, quantity: 1, verified: true, seller: sellers.denis },
  { id: 'o-104', eventId: 'basta-luzhniki', zone: 'fan', title: 'Фан-зона, у сцены', details: 'Вход 5 • Ранний вход с 16:30', delivery: 'Apple Wallet + PDF', eTicket: true, nominal: 6500, price: 6200, quantity: 2, verified: true, seller: sellers.maria },
  { id: 'o-105', eventId: 'basta-luzhniki', zone: 'stands', title: 'Сектор C112, Ряд 21, Места 3–4', details: 'Вход 4 • Два места рядом', delivery: 'PDF', eTicket: true, nominal: 3000, price: 2400, quantity: 2, verified: false, seller: sellers.igor },
  { id: 'o-106', eventId: 'basta-luzhniki', zone: 'dance', title: 'Танцпол', details: 'Свободный вход через Южный КПП', delivery: 'PDF', eTicket: true, nominal: 2500, price: 2450, quantity: 2, verified: true, seller: sellers.anna },

  // Лебединое озеро
  { id: 'o-201', eventId: 'swan-lake', zone: 'parterre', title: 'Партер, Ряд 9, Место 14', details: 'Историческая сцена • Именной билет', delivery: 'PDF', eTicket: true, nominal: 15000, price: 15000, quantity: 1, verified: true, seller: sellers.anna },
  { id: 'o-202', eventId: 'swan-lake', zone: 'box', title: 'Ложа бенуара 4, Места 1–2', details: 'Отличный обзор • Два места рядом', delivery: 'PDF', eTicket: true, nominal: 9000, price: 8200, quantity: 2, verified: true, seller: sellers.maria },
  { id: 'o-203', eventId: 'swan-lake', zone: 'amphi', title: 'Амфитеатр, Ряд 3, Место 22', details: 'Вход с Театральной пл.', delivery: 'PDF', eTicket: false, nominal: 4500, price: 4500, quantity: 1, verified: true, seller: sellers.denis },

  // Комиссаренко
  { id: 'o-301', eventId: 'komissarenko', zone: 'hall', title: 'Стол 3, Место 2', details: 'Первая линия у сцены', delivery: 'QR-код', eTicket: true, nominal: 3500, price: 3200, quantity: 1, verified: true, seller: sellers.ekaterina },
  { id: 'o-302', eventId: 'komissarenko', zone: 'hall', title: 'Стол 11, Места 1–2', details: 'Два места рядом', delivery: 'QR-код', eTicket: true, nominal: 2000, price: 1800, quantity: 2, verified: true, seller: sellers.igor },

  // Shortparis
  { id: 'o-401', eventId: 'shortparis', zone: 'dance', title: 'Танцпол', details: 'Open air • Свободный вход', delivery: 'Apple Wallet', eTicket: true, nominal: 2500, price: 2100, quantity: 1, verified: true, seller: sellers.alexey },
  { id: 'o-402', eventId: 'shortparis', zone: 'vip', title: 'VIP-терраса', details: 'Отдельный бар и вход', delivery: 'Apple Wallet', eTicket: true, nominal: 7000, price: 6500, quantity: 2, verified: true, seller: sellers.anna },

  // Щелкунчик
  { id: 'o-501', eventId: 'nutcracker-mariinsky', zone: 'parterre', title: 'Партер, Ряд 6, Места 10–11', details: 'Два места рядом • Новая сцена', delivery: 'PDF', eTicket: true, nominal: 11000, price: 11000, quantity: 2, verified: true, seller: sellers.maria },
  { id: 'o-502', eventId: 'nutcracker-mariinsky', zone: 'box', title: 'Ложа 2-го яруса, Место 3', details: 'Боковой обзор', delivery: 'PDF', eTicket: true, nominal: 5200, price: 4700, quantity: 1, verified: false, seller: sellers.igor },

  // Мумий Тролль
  { id: 'o-601', eventId: 'mumiy-troll-vk', zone: 'dance', title: 'Танцпол', details: 'Вход A • Электронный билет', delivery: 'Apple Wallet + PDF', eTicket: true, nominal: 4500, price: 4200, quantity: 2, verified: true, seller: sellers.denis },
  { id: 'o-602', eventId: 'mumiy-troll-vk', zone: 'stands', title: 'Сектор 108, Ряд 4, Место 9', details: 'Вход C', delivery: 'PDF', eTicket: true, nominal: 3500, price: 3500, quantity: 1, verified: true, seller: sellers.ekaterina },
];

export const PAYMENT_METHODS = [
  { id: 'sbp', title: 'СБП', subtitle: 'Без комиссии • Мгновенно в любом банке', icon: 'sbp', badge: { label: 'Выгодно', tone: 'success' } },
  { id: 'tpay', title: 'T-Pay', subtitle: 'В один клик без ввода карты', icon: 'tpay' },
  { id: 'sberpay', title: 'SberPay', subtitle: 'СберБанк Онлайн и бонусы Спасибо', icon: 'sberpay' },
  { id: 'yandexpay', title: 'Yandex Pay', subtitle: 'С кешбэком баллами Плюса', icon: 'yandexpay', badge: { label: '+3% Плюс', tone: 'brand' } },
  { id: 'card', title: 'Банковская карта', subtitle: 'МИР, Visa, Mastercard', icon: 'card', mono: true },
];

export const SERVICE_FEE_PERCENT = 0;
export const RESERVATION_SECONDS = 15 * 60;

// ---- Селекторы ----

export const getEvent = (id) => events.find((e) => e.id === id);
export const getOffer = (id) => offers.find((o) => o.id === id);
export const getOffersByEvent = (eventId) => offers.filter((o) => o.eventId === eventId);

export const getMinPrice = (eventId, list = offers) =>
  Math.min(...list.filter((o) => o.eventId === eventId).map((o) => o.price));

export const getVenues = () => [...new Set(events.map((e) => e.venue))];
