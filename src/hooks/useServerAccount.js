import { useEffect, useState } from 'react';
import { apiEnabled, getMe } from '@/lib/api';

// Состояние аккаунта на сервере: off (сервер не настроен) | loading | ok | error
export function useServerAccount() {
  const [state, setState] = useState(() => (apiEnabled ? { status: 'loading' } : { status: 'off' }));

  useEffect(() => {
    if (!apiEnabled) return;
    let alive = true;
    getMe()
      .then((data) => alive && setState({ status: 'ok', user: data.user, isNew: data.isNew }))
      .catch((error) => alive && setState({ status: 'error', error }));
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
