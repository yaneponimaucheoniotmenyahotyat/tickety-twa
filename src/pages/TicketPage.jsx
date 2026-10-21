import { useEffect, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import EventCover from '@/components/event/EventCover';
import EscrowTimeline from '@/components/tickets/EscrowTimeline';
import TicketQr from '@/components/tickets/TicketQr';
import Badge from '@/components/ui/Badge';
import { useNow } from '@/hooks/useNow';
import { useTicket } from '@/hooks/useTickets';
import { formatLongDate, formatPrice, formatTime } from '@/lib/format';
import { STATUS, ticketStatus } from '@/lib/tickets';
import { haptic, openLink } from '@/lib/telegram';

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-caption1 text-label-tertiary">{label}</dt>
    <dd className="text-subhead font-medium">{children}</dd>
  </div>
);

export default function TicketPage() {
  const { id } = useParams();
  const ticket = useTicket(id);
  const now = useNow(1000);
  const status = ticket ? ticketStatus(ticket, now) : null;

  // Вибрация, когда билет переоформлен и появился QR
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === 'transfer' && status === 'ready') haptic('success');
    prevStatus.current = status;
  }, [status]);

  if (!ticket) return <Navigate to="/tickets" replace />;
  const { event } = ticket;

  return (
    <>
      <TopBar title="Билет" left={<BackLink label="Билеты" />} />
      <main className="space-y-3 px-gutter pb-6 pt-3">
        <article className="card overflow-hidden">
          <EventCover event={event} className={`h-32 ${status === 'used' ? 'grayscale' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute left-4 top-4">
              <Badge tone={status === 'ready' ? 'glassSuccess' : 'glass'}>{STATUS[status].label}</Badge>
            </div>
            <h1 className="absolute inset-x-4 bottom-3 text-title3 text-white [text-wrap:balance]">{event.title}</h1>
          </EventCover>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            <Field label="Дата">{formatLongDate(event.date)}</Field>
            <Field label="Начало">
              {formatTime(event.date)} (вход с {event.doorsOpen})
            </Field>
            <Field label="Место">{ticket.seat}</Field>
            <Field label="Билетов">
              {ticket.quantity} • {formatPrice(ticket.total)}
            </Field>
            <div className="col-span-2">
              <Field label="Площадка">
                {event.venue}, {event.address}
              </Field>
            </div>
          </dl>

          {/* Линия отрыва: вырезы по краям обрезаются overflow-hidden карточки */}
          <div className="relative border-t border-dashed border-separator">
            <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-bg" />
            <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-bg" />
          </div>

          <TicketQr ticket={ticket} status={status} now={now} />
        </article>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() =>
              openLink(`https://yandex.ru/maps/?text=${encodeURIComponent(`${event.city}, ${event.address}`)}`)
            }
            className="card pressable flex items-center justify-center gap-2 p-3 text-subhead font-semibold text-brand"
          >
            <Icon name="pin" className="h-5 w-5" />
            Как добраться
          </button>
          <div className="card flex items-center justify-center gap-2 p-3 text-subhead font-medium text-label-secondary">
            <Icon name="qr" className="h-5 w-5" />
            {ticket.delivery}
          </div>
        </div>

        <EscrowTimeline ticket={ticket} status={status} />

        <p className="px-4 text-center text-caption1 text-label-tertiary">
          Если проход не состоится по вине продавца, Tickety вернёт {formatPrice(ticket.total)} в течение 3 дней.
        </p>
      </main>
    </>
  );
}
