import { useNavigate } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import FavoriteButton from '@/components/ui/FavoriteButton';
import EventCover from './EventCover';
import { DEMO_MODE } from '@/data/mockData';
import { formatEventDate, formatPrice, plural } from '@/lib/format';
import { haptic } from '@/lib/telegram';

// Бейджи на обложке — максимум два, в порядке важности для покупателя.
// «Осталось N», «Гарантия подлинности» и т.п. — выдуманные поля демо-каталога: только в демо.
function coverBadges(event, allVerified) {
  const list = [];
  if (DEMO_MODE && event.ticketsLeft) {
    const unit = event.category === 'standup' ? ['место', 'места', 'мест'] : ['билет', 'билета', 'билетов'];
    list.push(
      <Badge key="left" tone="danger">
        Осталось {event.ticketsLeft} {plural(event.ticketsLeft, unit)}
      </Badge>,
    );
  }
  if (DEMO_MODE && event.authenticity) list.push(<Badge key="auth" tone="glassSuccess" icon="shield-check">Гарантия подлинности</Badge>);
  if (DEMO_MODE && event.seatingLabel) list.push(<Badge key="seat" tone="glass" icon="seat">{event.seatingLabel}</Badge>);
  if (DEMO_MODE && event.eTicket) list.push(<Badge key="e" tone="glass" icon="contactless">Электронный вход</Badge>);
  if (allVerified) list.push(<Badge key="ai" tone="glassSuccess" icon="verified">Продавцы подтверждены</Badge>);
  return list.slice(0, 2);
}

export default function EventCard({ event, minPrice, allVerified }) {
  const navigate = useNavigate();
  const open = () => {
    haptic('light');
    navigate(`/event/${event.id}`);
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      className="card cursor-pointer overflow-hidden transition-transform duration-150 ease-ios active:scale-[0.985]"
    >
      <EventCover event={event} className="h-44">
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-64px)] flex-wrap gap-1.5">
          {coverBadges(event, allVerified)}
        </div>
        <div className="absolute right-3 top-3">
          <FavoriteButton eventId={event.id} />
        </div>
      </EventCover>

      <div className="p-4">
        <p className="flex items-center gap-1.5 text-footnote text-label-secondary">
          <Icon name="calendar" className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {formatEventDate(event.date)} • {event.venue}, {event.city}
          </span>
        </p>
        <h3 className="mt-2 line-clamp-2 text-headline">{event.title}</h3>
        <p className="mt-1 truncate text-subhead text-label-secondary">{event.description}</p>

        <div className="mt-4 flex items-end justify-between gap-3">
          {minPrice != null ? (
            <div>
              <p className="text-caption1 text-label-tertiary">Стоимость</p>
              <p className="text-title3 font-bold text-brand">от {formatPrice(minPrice)}</p>
            </div>
          ) : (
            <p className="text-subhead text-label-secondary">Пока нет предложений</p>
          )}
          <Button variant="soft" size="sm" iconRight="chevron-right" tabIndex={-1}>
            {minPrice != null ? 'Выбрать места' : 'Подробнее'}
          </Button>
        </div>
      </div>
    </article>
  );
}
