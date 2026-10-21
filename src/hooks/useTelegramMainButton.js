import { useEffect, useRef } from 'react';
import { tg } from '@/lib/telegram';

// Нативная MainButton Telegram (альтернатива кастомной CTA «Оплатить 3 800 ₽»).
// Пока используем свои кнопки из дизайна; хук готов для экрана оплаты.
export function useTelegramMainButton({ text, onClick, visible = true, loading = false }) {
  const handler = useRef(onClick);
  handler.current = onClick;

  useEffect(() => {
    const btn = tg?.MainButton;
    if (!btn) return;
    const fire = () => handler.current?.();

    btn.setParams({ text, color: '#0058BC', text_color: '#FFFFFF', is_visible: visible });
    loading ? btn.showProgress() : btn.hideProgress();
    btn.onClick(fire);
    return () => {
      btn.offClick(fire);
      btn.hide();
    };
  }, [text, visible, loading]);
}
