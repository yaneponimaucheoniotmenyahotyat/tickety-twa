import { useSyncExternalStore } from 'react';

// Избранное — удобство одного пользователя, поэтому localStorage (в try/catch:
// в приватных режимах WebView он бросает). Для синхронизации между устройствами
// позже заменить на Telegram CloudStorage.
const KEY = 'tickety:favorites';
const listeners = new Set();

function read() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY)) || []);
  } catch {
    return new Set();
  }
}

let favorites = read();

export function toggleFavorite(id) {
  favorites = new Set(favorites);
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...favorites]));
  } catch {
    /* хранилище недоступно — избранное живёт до перезагрузки */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useIsFavorite = (id) => useSyncExternalStore(subscribe, () => favorites.has(id));
