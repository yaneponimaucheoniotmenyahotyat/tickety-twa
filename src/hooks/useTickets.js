import { useSyncExternalStore } from 'react';
import { DEMO_TICKETS } from '@/lib/tickets';

// MVP: купленные билеты живут в localStorage (как и избранное).
// С бэкендом это станет запросом GET /me/tickets.
const KEY = 'tickety:tickets';
const listeners = new Set();

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

let purchased = read();
let all = [...purchased, ...DEMO_TICKETS];

export function addTicket(ticket) {
  purchased = [ticket, ...purchased];
  all = [...purchased, ...DEMO_TICKETS];
  try {
    localStorage.setItem(KEY, JSON.stringify(purchased));
  } catch {
    /* хранилище недоступно — билет живёт до перезагрузки */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useTickets = () => useSyncExternalStore(subscribe, () => all);
export const useTicket = (id) => useSyncExternalStore(subscribe, () => all.find((t) => t.id === id));
