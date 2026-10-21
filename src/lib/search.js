import { PRICE_LIMIT, events, getOffersByEvent, offers } from '@/data/mockData';

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
  popularity: { label: 'По популярности', compare: (a, b) => b.event.popularity - a.event.popularity },
  price: { label: 'Сначала дешевле', compare: (a, b) => a.minPrice - b.minPrice },
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

const offerMatches = (o, f) => {
  const [lo, hi] = f.price;
  const max = hi >= PRICE_LIMIT ? Infinity : hi; // «20 000+ ₽» — без верхней границы
  return (
    o.price >= lo &&
    o.price <= max &&
    (!f.aiVerified || o.verified) &&
    (!f.eTicket || o.eTicket) &&
    (!f.together || o.quantity >= 2)
  );
};

// Событие попадает в выдачу, если у него есть хотя бы одно подходящее предложение;
// «от N ₽» считается только по подходящим предложениям.
export function searchEvents({ query = '', filters, sort = 'popularity' }) {
  const q = query.trim().toLowerCase();
  const venue = filters.venue.trim().toLowerCase();

  const results = events.flatMap((event) => {
    if (filters.city && event.city !== filters.city) return [];
    if (filters.category !== 'all' && event.category !== filters.category) return [];
    if (venue && !event.venue.toLowerCase().includes(venue)) return [];
    if (q && ![event.title, event.venue, event.city, ...event.tags].some((s) => s.toLowerCase().includes(q))) {
      return [];
    }
    const matching = getOffersByEvent(event.id).filter((o) => offerMatches(o, filters));
    if (!matching.length) return [];
    return [
      {
        event,
        minPrice: Math.min(...matching.map((o) => o.price)),
        offersCount: matching.length,
        allVerified: matching.every((o) => o.verified),
      },
    ];
  });

  return results.sort(SORTS[sort].compare);
}

export const AVERAGE_PRICE =
  Math.round(offers.reduce((sum, o) => sum + o.price, 0) / offers.length / 100) * 100;
