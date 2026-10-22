// Объявления пользователей («Продать»). Два режима:
//   • сервер (VITE_API_URL задан) — объявления общие для всех, источник истины — API;
//   • локальный — localStorage этого устройства, свой билет видите только вы.
// Модуль не импортирует mockData — наоборот, mockData подмешивает активные объявления к лотам.
import {
  apiEnabled,
  createListing,
  fetchListings,
  fetchMyListings,
  withdrawListingRemote,
} from '@/lib/api';

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

// Локальный режим
let local = apiEnabled ? [] : read();
// Режим сервера: все активные объявления и мои (включая снятые)
let remoteActive = [];
let remoteMine = [];
let loadError = null;
// Первая загрузка с сервера завершилась (успешно или нет) — до неё «объявления нет» не значит «его нет»
let loaded = !apiEnabled;

let mine = apiEnabled ? remoteMine : local;
let active = apiEnabled ? remoteActive : local.filter((l) => l.status === 'active');

function emit() {
  mine = apiEnabled ? remoteMine : local;
  active = apiEnabled ? remoteActive : local.filter((l) => l.status === 'active');
  listeners.forEach((l) => l());
}

function saveLocal(next) {
  local = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(local));
  } catch {
    /* хранилище недоступно — объявление живёт до перезагрузки */
  }
  emit();
}

export const getListings = () => mine;
// Активные объявления в формате лота — их видит витрина и страница события
export const getListingOffers = () => active;
export const getListingsError = () => loadError;
export const getListingsLoaded = () => loaded;

// Подтянуть объявления с сервера (при старте и при открытии «Продать»)
export async function refreshListings() {
  if (!apiEnabled) return;
  try {
    const [all, my] = await Promise.all([
      fetchListings(),
      // «Мои» требуют входа; без него (браузер без Telegram) — просто пусто
      fetchMyListings().catch((e) => (e.status === 401 ? { listings: [] } : Promise.reject(e))),
    ]);
    remoteActive = all.listings;
    remoteMine = my.listings;
    loadError = null;
  } catch (e) {
    loadError = e.message;
  }
  loaded = true;
  emit();
}

// Локальный режим: готовое объявление из мастера
export const addListing = (listing) => saveLocal([listing, ...local]);

// Режим сервера: { checkId, price, quantity, sector?, row?, seat? } → объявление от сервера
export async function publishListing(body) {
  const { listing } = await createListing(body);
  remoteMine = [listing, ...remoteMine];
  remoteActive = [listing, ...remoteActive];
  emit();
  return listing;
}

export async function withdrawListing(id) {
  if (!apiEnabled) {
    saveLocal(local.map((l) => (l.id === id ? { ...l, status: 'withdrawn', withdrawnAt: Date.now() } : l)));
    return;
  }
  const { listing } = await withdrawListingRemote(id);
  remoteMine = remoteMine.map((l) => (l.id === id ? listing : l));
  remoteActive = remoteActive.filter((l) => l.id !== id);
  emit();
}

// «Сбросить данные на этом устройстве» — только локальные объявления; серверные снимаются по одному
export const clearListings = () => saveLocal([]);

export const subscribeListings = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
