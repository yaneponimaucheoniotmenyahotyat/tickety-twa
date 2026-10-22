import { useSyncExternalStore } from 'react';
import { DEMO_MODE } from '@/data/mockData';
import { DEMO_TICKETS } from '@/lib/tickets';

// Демо-билет (Земфира) — только в демо-режиме
const DEMO = DEMO_MODE ? DEMO_TICKETS : [];

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
let all = [...purchased, ...DEMO];

function save(next) {
  purchased = next;
  all = [...purchased, ...DEMO];
  try {
    localStorage.setItem(KEY, JSON.stringify(purchased));
  } catch {
    /* хранилище недоступно — билеты живут до перезагрузки */
  }
  listeners.forEach((l) => l());
}

export const addTicket = (ticket) => save([ticket, ...purchased]);
export const clearTickets = () => save([]);

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useTickets = () => useSyncExternalStore(subscribe, () => all);
export const useTicket = (id) => useSyncExternalStore(subscribe, () => all.find((t) => t.id === id));
