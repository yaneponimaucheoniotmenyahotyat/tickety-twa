import { useSyncExternalStore } from 'react';
import { apiEnabled, fetchConfig } from '@/lib/api';

// Режим оплаты на сервере: test — бета с тестовыми деньгами, off — покупка выключена.
// loading — ещё не знаем; без сервера (демо) — demo.
let mode = apiEnabled ? 'loading' : 'demo';
const listeners = new Set();
let requested = false;

function load() {
  if (requested || !apiEnabled) return;
  requested = true;
  fetchConfig()
    .then((c) => (mode = c.payments))
    .catch(() => (mode = 'off'))
    .finally(() => listeners.forEach((l) => l()));
}

const subscribe = (l) => {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
};

export const usePaymentsMode = () => useSyncExternalStore(subscribe, () => mode);
