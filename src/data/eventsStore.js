// Каталог событий. Два режима, как у объявлений:
//   • демо (сервер не подключён) — выдуманные события из shared/catalog.js;
//   • бета — события с сервера: их заводит администратор по официальному прайсу.
// status: loading | ok | error — пока каталог не пришёл, страницы не делают вывод «события нет».
import { events as catalogEvents } from '../../shared/catalog.js';
import { catalogZones } from '../../shared/listingRules.js';
import { apiEnabled, fetchEvents } from '@/lib/api';

const listeners = new Set();
let state = apiEnabled
  ? { status: 'loading', events: [] }
  : { status: 'ok', events: catalogEvents.map((e) => ({ ...e, zones: catalogZones(e.id) })) };
let loading = null;

function set(next) {
  state = next;
  listeners.forEach((l) => l());
}

export const getEventsState = () => state;
export const getEvents = () => state.events;
export const subscribeEvents = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function refreshEvents() {
  if (!apiEnabled) return Promise.resolve();
  loading ??= fetchEvents()
    .then(({ events }) => set({ status: 'ok', events }))
    // Уже загруженный каталог не теряем из-за временной ошибки сети
    .catch((error) => set({ ...state, status: state.events.length ? 'ok' : 'error', error }))
    .finally(() => {
      loading = null;
    });
  return loading;
}

// После сохранения в админке — витрина видит правку сразу, без перезагрузки
export function applyEventChange(event) {
  const rest = state.events.filter((e) => e.id !== event.id);
  const visible = event.status === 'published';
  set({
    ...state,
    events: visible ? [...rest, event].sort((a, b) => new Date(a.date) - new Date(b.date)) : rest,
  });
}
