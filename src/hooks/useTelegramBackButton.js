import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tg } from '@/lib/telegram';

// Нативная кнопка «Назад» Telegram: видна на всех экранах, кроме корня.
export function useTelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const back = tg?.BackButton;
    if (!back || !tg.isVersionAtLeast('6.1')) return;

    const onBack = () => navigate(-1);
    if (location.pathname === '/') back.hide();
    else back.show();
    back.onClick(onBack);
    return () => back.offClick(onBack);
  }, [location.pathname, navigate]);
}
