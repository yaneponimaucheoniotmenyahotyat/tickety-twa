import { useNavigate } from 'react-router-dom';
import { COVERS } from '../../../shared/eventRules.js';
import EventCover from '@/components/event/EventCover';
import Badge from '@/components/ui/Badge';
import { withdrawListing } from '@/data/listingsStore';
import { formatEventDate, formatPrice } from '@/lib/format';
import { confirmDialog, haptic } from '@/lib/telegram';

const STATUS = {
  active: { label: 'В продаже', tone: 'success' },
  sold: { label: 'Продано', tone: 'success' },
  withdrawn: { label: 'Снято', tone: 'neutral' },
  removed: { label: 'Снято модератором', tone: 'danger' },
};

export default function ListingCard({ listing, event: found }) {
  const navigate = useNavigate();
  const active = listing.status === 'active';
  const status = STATUS[listing.status] ?? STATUS.withdrawn;
  const event = found ?? { id: listing.eventId, title: 'Событие недоступно', date: null, cover: COVERS[0] };

  const withdraw = async () => {
    const ok = await confirmDialog('Снять билет с продажи? Покупатели перестанут его видеть.');
    if (!ok) return;
    try {
      await withdrawListing(listing.id);
      haptic('success');
    } catch (e) {
      haptic('error');
      await confirmDialog(`Не получилось снять с продажи: ${e.message}`);
    }
  };

  return (
    <article className={`card p-4 ${active ? '' : 'opacity-60'}`}>
      <div className="flex gap-3">
        <EventCover event={event} className={`h-14 w-14 shrink-0 rounded-xl ${active ? '' : 'grayscale'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-headline">{event.title}</p>
            <Badge tone={status.tone} size="sm" className="shrink-0">
              {status.label}
            </Badge>
          </div>
          <p className="truncate text-footnote text-label-secondary">
            {event.date ? `${formatEventDate(event.date)} • ` : ''}
            {listing.title}
          </p>
          <p className="mt-1 text-subhead">
            <b>{formatPrice(listing.price)}</b>
            {listing.quantity > 1 && <span className="text-label-secondary"> × {listing.quantity}</span>}
            <span className="text-label-tertiary"> / номинал {formatPrice(listing.nominal)}</span>
          </p>
        </div>
      </div>
      {listing.removedReason && (
        <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-footnote text-danger">
          Причина: {listing.removedReason}
        </p>
      )}
      {active && found && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate(`/event/${event.id}`)}
            className="pressable h-9 rounded-xl bg-brand-soft text-footnote font-semibold text-brand-ink"
          >
            Как видят покупатели
          </button>
          <button
            type="button"
            onClick={withdraw}
            className="pressable h-9 rounded-xl bg-fill text-footnote font-semibold text-danger"
          >
            Снять с продажи
          </button>
        </div>
      )}
    </article>
  );
}
