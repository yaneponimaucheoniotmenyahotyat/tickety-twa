// Клиент API Tickety. Адрес сервера — VITE_API_URL при сборке.
// Не задан — приложение работает как раньше, только на устройстве (localStorage).
import { tg } from './telegram';

// VITE_API_URL=/ — API на том же адресе, что и приложение (режим phone-api через туннель)
const RAW = import.meta.env.VITE_API_URL || '';
const BASE = RAW.replace(/\/$/, '');
export const apiEnabled = Boolean(RAW);

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

// body — JSON; form — FormData (загрузка файла, Content-Type с boundary ставит браузер)
export async function api(path, { method = 'GET', body, form } = {}) {
  if (!apiEnabled) throw new ApiError(0, 'disabled', 'Сервер не настроен');
  const headers = {};
  const auth = authorization();
  if (auth) headers.Authorization = auth;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch {
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
