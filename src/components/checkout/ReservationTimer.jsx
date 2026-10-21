import { formatCountdown } from '@/lib/format';

export default function ReservationTimer({ seconds }) {
  const urgent = seconds <= 60;
  return (
    <div className="inline-flex items-center gap-2 rounded-chip bg-surface px-3 py-1.5 shadow-card">
      <span className={`h-2 w-2 rounded-full bg-danger ${urgent ? 'animate-pulse' : ''}`} />
      <span className="text-footnote font-medium">
        {seconds > 0 ? 'Бронь:' : 'Бронь истекла'}
      </span>
      {seconds > 0 && (
        <span className="text-footnote font-bold tabular-nums text-danger">{formatCountdown(seconds)}</span>
      )}
    </div>
  );
}
