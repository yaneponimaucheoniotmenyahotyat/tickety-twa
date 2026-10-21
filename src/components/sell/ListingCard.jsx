import { useNavigate } from 'react-router-dom';
import EventCover from '@/components/event/EventCover';
import Badge from '@/components/ui/Badge';
import { withdrawListing } from '@/data/listingsStore';
import { formatEventDate, formatPrice } from '@/lib/format';
import { confirmDialog, haptic } from '@/lib/telegram';

export default function ListingCard({ listing, event }) {
  const navigate = useNavigate();
  const active = listing.status === 'active';

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
            <Badge tone={active ? 'success' : 'neutral'} size="sm" className="shrink-0">
              {active ? 'В продаже' : 'Снято'}
            </Badge>
          </div>
          <p className="truncate text-footnote text-label-secondary">
            {formatEventDate(event.date)} • {listing.title}
          </p>
          <p className="mt-1 text-subhead">
            <b>{formatPrice(listing.price)}</b>
            {listing.quantity > 1 && <span className="text-label-secondary"> × {listing.quantity}</span>}
            <span className="text-label-tertiary"> / номинал {formatPrice(listing.nominal)}</span>
          </p>
        </div>
      </div>
      {active && (
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
