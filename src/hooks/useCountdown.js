import { useEffect, useRef, useState } from 'react';

// Обратный отсчёт от фиксированного дедлайна: не «уплывает» при ререндерах
// и при сворачивании Mini App (setInterval в фоне засыпает).
export function useCountdown(totalSeconds, running = true) {
  const deadline = useRef(Date.now() + totalSeconds * 1000);
  const calc = () => Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
  const [left, setLeft] = useState(calc);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const v = calc();
      setLeft(v);
      if (v === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  return left;
}
