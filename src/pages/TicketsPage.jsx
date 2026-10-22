import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import TopBar from '@/components/layout/TopBar';
import TicketListItem from '@/components/tickets/TicketListItem';
import Button from '@/components/ui/Button';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { useNow } from '@/hooks/useNow';
import { useTickets } from '@/hooks/useTickets';
import { DEMO_MODE } from '@/data/mockData';
import { ticketStatus } from '@/lib/tickets';
import { OrdersList } from './OrdersPage';

// Бета (с сервером): настоящие покупки с удержанием денег
function BetaTicketsPage() {
  return (
    <>
      <TopBar title="Мои билеты" />
      <main className="px-gutter pb-6 pt-3">
        <OrdersList />
      </main>
    </>
  );
}

export default function TicketsPage() {
  return DEMO_MODE ? <DemoTicketsPage /> : <BetaTicketsPage />;
}

function DemoTicketsPage() {
  const navigate = useNavigate();
  const tickets = useTickets();
  const now = useNow(5000); // статус «Переоформление → Готов» меняется со временем
  const [tab, setTab] = useState('upcoming');

  const { upcoming, past } = useMemo(() => {
    const withStatus = tickets.map((t) => ({ ticket: t, status: ticketStatus(t, now) }));
    const byDate = (a, b) => new Date(a.ticket.event.date) - new Date(b.ticket.event.date);
    return {
      upcoming: withStatus.filter((x) => x.status !== 'used').sort(byDate),
      past: withStatus.filter((x) => x.status === 'used').sort((a, b) => byDate(b, a)),
    };
  }, [tickets, now]);

  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <>
      <TopBar title="Мои билеты" />
      <main className="space-y-3 px-gutter pb-6 pt-3">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: `Предстоящие (${upcoming.length})` },
            { value: 'past', label: `Прошедшие (${past.length})` },
          ]}
        />

        {list.length > 0 ? (
          list.map(({ ticket, status }) => (
            <TicketListItem key={ticket.id} ticket={ticket} status={status} now={now} />
          ))
        ) : (
          <div className="card flex flex-col items-center px-6 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon name="tab-tickets" className="h-8 w-8" />
            </span>
            <p className="mt-3 text-headline">
              {tab === 'upcoming' ? 'Здесь появятся купленные билеты' : 'Прошедших событий пока нет'}
            </p>
            <p className="mt-1 text-subhead text-label-secondary">
              Билеты по цене не выше номинала от продавцов с подтверждённым номером
            </p>
            {tab === 'upcoming' && (
              <Button className="mt-5" iconRight="chevron-right" onClick={() => navigate('/')}>
                Найти события
              </Button>
            )}
          </div>
        )}
      </main>
    </>
  );
}
