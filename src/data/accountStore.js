// Аккаунт на сервере — общий для «Профиля» и «Продать».
// status: off (сервер не настроен) | loading | ok | error
import { apiEnabled, getMe, verifyPhone } from '@/lib/api';
import { haptic, requestContact } from '@/lib/telegram';

const listeners = new Set();
let state = apiEnabled ? { status: 'loading' } : { status: 'off' };
let loading = null;

function set(next) {
  state = next;
  listeners.forEach((l) => l());
}

export const getAccount = () => state;
export const subscribeAccount = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function loadAccount() {
  if (!apiEnabled) return Promise.resolve();
  if (!loading && state.status !== 'loading') set({ status: 'loading' }); // «Повторить» после ошибки
  loading ??= getMe()
    .then((data) => set({ status: 'ok', user: data.user, isNew: data.isNew }))
    .catch((error) => set({ status: 'error', error }))
    .finally(() => {
      loading = null;
    });
  return loading;
}

// Нативный диалог «Поделиться номером» → подписанный ответ → сервер проверяет подпись.
// Возвращает null при успехе или текст ошибки для показа.
export async function confirmPhone() {
  const response = await requestContact();
  if (!response) return 'Номер не получен — нажмите «Поделиться» в окне Telegram';
  try {
    const { user } = await verifyPhone(response);
    set({ ...state, status: 'ok', user });
    haptic('success');
    return null;
  } catch (e) {
    haptic('error');
    return e.message;
  }
}
