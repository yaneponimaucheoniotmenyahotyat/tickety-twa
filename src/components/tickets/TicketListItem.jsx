import { useNavigate } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import Badge from '@/components/ui/Badge';
import EventCover from '@/components/event/EventCover';
import { formatDaysLeft, formatEventDate } from '@/lib/format';
import { STATUS } from '@/lib/tickets';
import { haptic } from '@/lib/telegram';

export default function TicketListItem({ ticket, status, now }) {
  const navigate = useNavigate();
  const { event } = ticket;
  const past = status === 'used';

  return (
    <button
      type="button"
      onClick={() => {
        haptic('light');
        navigate(`/tickets/${ticket.id}`);
      }}
      className={`card pressable flex w-full items-center gap-3 p-3 text-left ${past ? 'opacity-70' : ''}`}
    >
      <EventCover event={event} className={`h-16 w-16 shrink-0 rounded-xl ${past ? 'grayscale' : ''}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-headline">{event.title}</p>
        <p className="truncate text-footnote text-label-secondary">
          {formatEventDate(event.date)} • {event.venue}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <Badge tone={STATUS[status].tone} size="sm">
            {STATUS[status].label}
          </Badge>
          {!past && <span className="text-caption1 text-label-tertiary">{formatDaysLeft(event.date, now)}</span>}
        </div>
      </div>
      <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-label-tertiary" />
    </button>
  );
}
