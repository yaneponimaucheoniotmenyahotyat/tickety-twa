// Клиент API Tickety. Адрес сервера — VITE_API_URL при сборке.
// Не задан — приложение работает как раньше, только на устройстве (localStorage).
import { tg } from './telegram';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const apiEnabled = Boolean(BASE);

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

export async function api(path, { method = 'GET', body } = {}) {
  if (!apiEnabled) throw new ApiError(0, 'disabled', 'Сервер не настроен');
  const headers = {};
  const auth = authorization();
  if (auth) headers.Authorization = auth;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', 'Нет связи с сервером');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'http', data.message ?? `Ошибка ${res.status}`);
  return data;
}

export const getMe = () => api('/api/me');
