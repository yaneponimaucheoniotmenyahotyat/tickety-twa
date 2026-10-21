import { useEffect, useState } from 'react';

// Текущее время с перерисовкой раз в intervalMs (статусы билетов, ротация QR)
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
