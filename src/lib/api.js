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
