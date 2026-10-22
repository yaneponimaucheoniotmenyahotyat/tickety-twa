// Клиент API Tickety. Адрес сервера — VITE_API_URL при сборке.
// Не задан — приложение работает как раньше, только на устройстве (localStorage).
import { tg } from './telegram';

// VITE_API_URL=/ — API на том же адресе, что и приложение (режим phone-api через туннель)
const RAW = import.meta.env.VITE_API_URL || '';
// VITE_API_DISCOVERY — бета на GitHub Pages (/dev/): адрес сервера за туннелем меняется,
// поэтому при запуске читаем его из tunnel.json (пишет scripts/tunnel-bot.mjs).
// Приложение при этом остаётся на своём постоянном адресе — Telegram не теряет с ним связь
// (после перехода на чужой домен запрос контакта переставал работать).
const DISCOVERY = import.meta.env.VITE_API_DISCOVERY || '';
let BASE = RAW.replace(/\/$/, '');
export const apiEnabled = Boolean(RAW || DISCOVERY);

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Личность подтверждает подпись Telegram (initData). В локальной разработке в браузере
// подписи нет — тогда dev-заголовок, который сервер принимает только с ALLOW_DEV_AUTH=1.
function authorization() {
  if (tg?.initData) return `tma ${tg.initData}`;
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_USER_ID) return `dev ${import.meta.env.VITE_DEV_USER_ID}`;
  return null;
}

let discovering = null;
function serverBase() {
  if (!DISCOVERY) return Promise.resolve(BASE);
  discovering ??= fetch(`${DISCOVERY}&t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github.raw+json' },
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(({ url }) => {
      if (!url) throw new ApiError(0, 'server_off', 'Тестовый сервер выключен — попробуйте позже');
      BASE = url.replace(/\/$/, '');
      return BASE;
    })
    .catch((e) => {
      discovering = null; // в следующий раз спросим снова
      throw e instanceof ApiError ? e : new ApiError(0, 'network', 'Не удалось найти тестовый сервер');
    });
  return discovering;
}

// body — JSON; form — FormData (загрузка файла, Content-Type с boundary ставит браузер)
export async function api(path, { method = 'GET', body, form } = {}, retried = false) {
  if (!apiEnabled) throw new ApiError(0, 'disabled', 'Сервер не настроен');
  const headers = {};
  const auth = authorization();
  if (auth) headers.Authorization = auth;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const base = await serverBase();
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch {
    // Туннель мог сменить адрес, пока приложение было открыто — узнаём новый и пробуем ещё раз
    if (DISCOVERY && !retried) {
      discovering = null;
      return api(path, { method, body, form }, true);
    }
    throw new ApiError(0, 'network', 'Нет связи с сервером');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'http', data.message ?? `Ошибка ${res.status}`);
  return data;
}

export const getMe = () => api('/api/me');
export const verifyPhone = (response) => api('/api/me/phone', { method: 'POST', body: { response } });

// ---- События ----
export const fetchEvents = () => api('/api/events');

// ---- Админка ----
export const adminEvents = () => api('/api/admin/events');
export const adminCreateEvent = (body) => api('/api/admin/events', { method: 'POST', body });
export const adminUpdateEvent = (id, body) => api(`/api/admin/events/${id}`, { method: 'PUT', body });
export const adminListings = (status = 'active') => api(`/api/admin/listings?status=${status}`);
export const adminRemoveListing = (id, reason) => api(`/api/admin/listings/${id}/remove`, { method: 'POST', body: { reason } });
export const adminBlockUser = (id, reason) => api(`/api/admin/users/${id}/block`, { method: 'POST', body: { reason } });
export const adminUnblockUser = (id) => api(`/api/admin/users/${id}/unblock`, { method: 'POST' });

export const adminWithdrawEvent = (id, reason) => api(`/api/admin/events/${id}/withdraw`, { method: 'POST', body: { reason } });
export const adminPublishEvent = (id) => api(`/api/admin/events/${id}/publish`, { method: 'POST' });
export const adminDeleteEvent = (id) => api(`/api/admin/events/${id}`, { method: 'DELETE' });
export const adminStaff = () => api('/api/admin/staff');
export const adminAddStaff = (userId, role) => api('/api/admin/staff', { method: 'POST', body: { userId, role } });
export const adminRemoveStaff = (userId, role) => api(`/api/admin/staff/${userId}/${role}`, { method: 'DELETE' });
export const adminSupportThreads = (status = 'open') => api(`/api/admin/support?status=${status}`);
export const adminSupportThread = (id) => api(`/api/admin/support/${id}`);
export const adminSupportReply = (id, body) => api(`/api/admin/support/${id}/messages`, { method: 'POST', body: { body } });
export const adminSupportClose = (id) => api(`/api/admin/support/${id}/close`, { method: 'POST' });

export const adminOrders = (status = 'disputed') => api(`/api/admin/orders?status=${status}`);
export const adminRefundOrder = (id, reason) => api(`/api/admin/orders/${id}/refund`, { method: 'POST', body: { reason } });
export const adminReleaseOrder = (id, reason) => api(`/api/admin/orders/${id}/release`, { method: 'POST', body: { reason } });

// ---- Покупки и кошелёк ----
export const fetchConfig = () => api('/api/config');
export const createOrder = (listingId) => api('/api/orders', { method: 'POST', body: { listingId } });
export const payOrder = (id) => api(`/api/orders/${id}/pay`, { method: 'POST', body: { method: 'test' } });
export const cancelOrder = (id) => api(`/api/orders/${id}/cancel`, { method: 'POST' });
export const fetchOrders = () => api('/api/orders');
export const fetchOrder = (id) => api(`/api/orders/${id}`);
export const confirmOrder = (id) => api(`/api/orders/${id}/confirm`, { method: 'POST' });
export const disputeOrder = (id, reason) => api(`/api/orders/${id}/dispute`, { method: 'POST', body: { reason } });
export const ticketLink = (id) => api(`/api/orders/${id}/ticket-link`, { method: 'POST' });
export const fetchWallet = () => api('/api/wallet');
export const requestPayout = (amount) => api('/api/wallet/payouts', { method: 'POST', body: { amount } });

// Полный адрес для ссылки, которую открывает Telegram (браузер без нашего заголовка авторизации)
export const absoluteApiUrl = (path) => `${BASE || window.location.origin}${path}`;

// ---- Поддержка ----
export const supportThreads = () => api('/api/support/threads');
export const supportThread = (id) => api(`/api/support/threads/${id}`);
export const createSupportThread = (body) => api('/api/support/threads', { method: 'POST', body });
export const sendSupportMessage = (id, body) => api(`/api/support/threads/${id}/messages`, { method: 'POST', body: { body } });

// ---- Объявления ----
export const fetchListings = () => api('/api/listings');
export const fetchMyListings = () => api('/api/me/listings');

// eventId — до файла: сервер читает поля формы, которые пришли раньше файла
export function uploadTicket(file, eventId) {
  const form = new FormData();
  form.append('eventId', eventId);
  form.append('file', file, file.name);
  return api('/api/ticket-checks', { method: 'POST', form });
}

export const createListing = (body) => api('/api/listings', { method: 'POST', body });
export const withdrawListingRemote = (id) => api(`/api/listings/${id}/withdraw`, { method: 'POST' });
