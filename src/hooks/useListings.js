import { useSyncExternalStore } from 'react';
import { getListings, subscribeListings } from '@/data/listingsStore';

export const useListings = () => useSyncExternalStore(subscribeListings, getListings);
