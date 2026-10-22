import { useSyncExternalStore } from 'react';
import { getEvents, getEventsState, subscribeEvents } from '@/data/eventsStore';

// События каталога — страницы перерисуются, когда они придут с сервера
export const useEvents = () => useSyncExternalStore(subscribeEvents, getEvents);
// { status: loading | ok | error, events, error }
export const useEventsState = () => useSyncExternalStore(subscribeEvents, getEventsState);
