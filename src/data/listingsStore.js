// Объявления пользователя («Продать»). В MVP — localStorage этого устройства:
// свой билет видите только вы. С бэкендом объявления станут общими для всех покупателей.
// Модуль не импортирует mockData — наоборот, mockData подмешивает активные объявления к лотам.
const KEY = 'tickety:listings';
const listeners = new Set();

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

let listings = read();
let active = listings.filter((l) => l.status === 'active');

function save(next) {
  listings = next;
  active = listings.filter((l) => l.status === 'active');
  try {
    localStorage.setItem(KEY, JSON.stringify(listings));
  } catch {
    /* хранилище недоступно — объявление живёт до перезагрузки */
  }
  listeners.forEach((l) => l());
}

export const getListings = () => listings;
// Активные объявления в формате лота — их видит витрина и страница события
export const getListingOffers = () => active;

export const addListing = (listing) => save([listing, ...listings]);
export const withdrawListing = (id) =>
  save(listings.map((l) => (l.id === id ? { ...l, status: 'withdrawn', withdrawnAt: Date.now() } : l)));
export const clearListings = () => save([]);

export const subscribeListings = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
