import { getEvents } from '@/data/eventsStore';
import { DEMO_MODE, PRICE_LIMIT, getOffersByEvent, offers } from '@/data/mockData';

export const DEFAULT_FILTERS = {
  city: null, // null — все города
  category: 'all',
  venue: '',
  price: [0, PRICE_LIMIT],
  aiVerified: false,
  eTicket: false,
  together: false,
};

export const SORTS = {
  // У демо-событий — выдуманная популярность, в бете — число предложений
  popularity: {
    label: 'По популярности',
    compare: (a, b) =>
      (b.event.popularity ?? b.offersCount) - (a.event.popularity ?? a.offersCount) ||
      new Date(a.event.date) - new Date(b.event.date),
  },
  price: { label: 'Сначала дешевле', compare: (a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity) || 0 },
  date: { label: 'Ближайшие', compare: (a, b) => new Date(a.event.date) - new Date(b.event.date) },
};

// Категория вынесена в чипсы витрины, поэтому в индикатор «фильтры активны» не входит
export function countActiveFilters(f) {
  const d = DEFAULT_FILTERS;
  return [
    f.city !== d.city,
    f.venue.trim() !== '',
    f.price[0] !== d.price[0] || f.price[1] !== d.price[1],
    f.aiVerified,
    f.eTicket,
    f.together,
  ].filter(Boolean).length;
}

const offerFiltersActive = (f) =>
  f.price[0] !== DEFAULT_FILTERS.price[0] || f.price[1] !== DEFAULT_FILTERS.price[1] || f.aiVerified || f.eTicket || f.together;

const offerMatches = (o, f) => {
  const [lo, hi] = f.price;
  const max = hi >= PRICE_LIMIT ? Infinity : hi; // «20 000+ ₽» — без верхней границы
  return (
    !o.own && // свои объявления купить нельзя — в «от N ₽» и фильтрах их не учитываем
    o.price >= lo &&
    o.price <= max &&
    (!f.aiVerified || o.verified) &&
    (!f.eTicket || o.eTicket) &&
    (!f.together || o.quantity >= 2)
  );
};

// С фильтрами по предложениям (цена, проверенные продавцы, электронный вход, места рядом)
// событие попадает в выдачу, только если есть подходящее предложение. Без них — показываем
// и события без предложений: в бете их поначалу большинство, пустая витрина хуже.
// «от N ₽» считается только по подходящим предложениям.
export function searchEvents({ query = '', filters, sort = 'popularity' }) {
  const q = query.trim().toLowerCase();
  const venue = filters.venue.trim().toLowerCase();

  const results = getEvents().flatMap((event) => {
    if (filters.city && event.city !== filters.city) return [];
    if (filters.category !== 'all' && event.category !== filters.category) return [];
    if (venue && !event.venue.toLowerCase().includes(venue)) return [];
    if (q && ![event.title, event.venue, event.city, ...event.tags].some((s) => s.toLowerCase().includes(q))) {
      return [];
    }
    const matching = getOffersByEvent(event.id).filter((o) => offerMatches(o, filters));
    if (!matching.length && offerFiltersActive(filters)) return [];
    return [
      {
        event,
        minPrice: matching.length ? Math.min(...matching.map((o) => o.price)) : null,
        offersCount: matching.length,
        allVerified: matching.length > 0 && matching.every((o) => o.verified),
      },
    ];
  });

  return results.sort(SORTS[sort].compare);
}

// Средняя цена демо-лотов — подсказка в фильтре; в бете не показываем (выборка пока мала)
export const AVERAGE_PRICE = DEMO_MODE
  ? Math.round(offers.reduce((sum, o) => sum + o.price, 0) / offers.length / 100) * 100
  : null;
