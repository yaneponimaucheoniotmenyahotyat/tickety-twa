import { useSyncExternalStore } from 'react';
import { getListingOffers, getListings, getListingsError, subscribeListings } from '@/data/listingsStore';

// Мои объявления (для «Продать»)
export const useListings = () => useSyncExternalStore(subscribeListings, getListings);
// Активные объявления всех продавцов — витрина и страница события перерисуются, когда они придут с сервера
export const useListingOffers = () => useSyncExternalStore(subscribeListings, getListingOffers);
export const useListingsError = () => useSyncExternalStore(subscribeListings, getListingsError);
