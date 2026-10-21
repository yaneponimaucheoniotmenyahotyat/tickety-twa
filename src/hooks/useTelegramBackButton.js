import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tg } from '@/lib/telegram';

// Корни вкладок таб-бара: «Назад» на них не нужна, как в iOS
const TAB_ROOTS = ['/', '/tickets', '/sell', '/profile'];

// Нативная кнопка «Назад» Telegram: видна на всех вложенных экранах.
// Шаги мастера продажи живут в ?step=, поэтому «Назад» ведёт на прошлый шаг.
export function useTelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const back = tg?.BackButton;
    if (!back || !tg.isVersionAtLeast('6.1')) return;

    const onBack = () => navigate(-1);
    if (TAB_ROOTS.includes(location.pathname)) back.hide();
    else back.show();
    back.onClick(onBack);
    return () => back.offClick(onBack);
  }, [location.pathname, navigate]);
}
