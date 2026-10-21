import { useEffect, useSyncExternalStore } from 'react';
import { getAccount, loadAccount, subscribeAccount } from '@/data/accountStore';

// Состояние аккаунта на сервере: off (сервер не настроен) | loading | ok | error
export function useServerAccount() {
  const state = useSyncExternalStore(subscribeAccount, getAccount);
  useEffect(() => {
    if (state.status === 'loading') loadAccount();
  }, [state.status]);
  return state;
}
