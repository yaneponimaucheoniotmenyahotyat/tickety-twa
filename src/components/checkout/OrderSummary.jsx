import Badge from '@/components/ui/Badge';
import EventCover from '@/components/event/EventCover';
import { formatEventDate, formatPrice } from '@/lib/format';

export default function OrderSummary({ event, offer, subtotal, fee, feePercent, total }) {
  return (
    <section className="card p-4">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          {offer.verified && (
            <Badge tone="mint" icon="verified">
              Проверено Tickety AI
            </Badge>
          )}
          <h2 className="mt-2 text-headline">{event.title}</h2>
          <p className="mt-1 text-footnote text-label-secondary">
            {formatEventDate(event.date)} • {event.venue}, {event.city}
          </p>
        </div>
        <EventCover event={event} className="h-14 w-14 shrink-0 rounded-xl" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="neutral" icon="seat">{offer.title}</Badge>
        <Badge tone="brand" icon="qr">{offer.delivery}</Badge>
      </div>

      <dl className="mt-4 space-y-2 text-subhead">
        <div className="flex justify-between">
          <dt>
            {offer.quantity} × Входной билет
          </dt>
          <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-2">
            Сервисный сбор <Badge tone="success" size="sm">{feePercent}%</Badge>
          </dt>
          <dd className="tabular-nums text-success">{formatPrice(fee)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between border-t border-separator pt-3">
        <span className="text-headline">Итого к оплате</span>
        <span className="text-title2 tabular-nums text-brand">{formatPrice(total)}</span>
      </div>
    </section>
  );
}
