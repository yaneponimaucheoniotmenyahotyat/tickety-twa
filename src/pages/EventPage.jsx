import { useMemo, useState } from 'react';
import { useListingOffers } from '@/hooks/useListings';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import EventHero from '@/components/event/EventHero';
import FairPriceCard from '@/components/event/FairPriceCard';
import OfferCard from '@/components/event/OfferCard';
import FavoriteButton from '@/components/ui/FavoriteButton';
import Button from '@/components/ui/Button';
import DemoNotice from '@/components/ui/DemoNotice';
import SafeDealNotice from '@/components/ui/SafeDealNotice';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { ZONES, getEvent, getOffersByEvent } from '@/data/mockData';
import { formatLongDate, formatTime, plural } from '@/lib/format';
import { openLink } from '@/lib/telegram';

function InfoRow({ icon, title, subtitle, action }) {
  return (
    <div className="flex gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-headline">{title}</p>
        <p className="text-subhead text-label-secondary">{subtitle}</p>
        {action}
      </div>
    </div>
  );
}

export default function EventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const event = getEvent(id);
  const listingOffers = useListingOffers(); // перерисовка, когда пришли объявления с сервера
  const allOffers = useMemo(
    () => (event ? getOffersByEvent(event.id).sort((a, b) => a.price - b.price) : []),
    [event, listingOffers],
  );
  const [zone, setZone] = useState('all');

  if (!event) return <Navigate to="/" replace />;

  const zoneOptions = [
    { value: 'all', label: `Все (${allOffers.length})` },
    ...[...new Set(allOffers.map((o) => o.zone))].map((z) => ({ value: z, label: ZONES[z] })),
  ];
  const list = zone === 'all' ? allOffers : allOffers.filter((o) => o.zone === zone);

  return (
    <>
      <TopBar title="Событие" left={<BackLink label="Поиск" />} right={<FavoriteButton eventId={event.id} variant="plain" />} />

      <main className="space-y-3 px-gutter pb-8 pt-3">
        <DemoNotice />
        <EventHero event={event} />

        <section className="card divide-y divide-separator">
          <InfoRow
            icon="calendar"
            title={formatLongDate(event.date)}
            subtitle={`Начало в ${formatTime(event.date)} (вход с ${event.doorsOpen})`}
          />
          <InfoRow
            icon="pin"
            title={`${event.venue}, ${event.city}`}
            subtitle={event.address}
            action={
              <button
                type="button"
                onClick={() => openLink(`https://yandex.ru/maps/?text=${encodeURIComponent(`${event.city}, ${event.address}`)}`)}
                className="mt-1 flex items-center text-subhead font-semibold text-brand"
              >
                Открыть на карте
                <Icon name="chevron-right" className="h-4 w-4" />
              </button>
            }
          />
        </section>

        <FairPriceCard />

        <section className="pt-3">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-title3">Билеты в продаже</h2>
            <span className="text-footnote text-label-secondary">
              {allOffers.length} {plural(allOffers.length, ['предложение', 'предложения', 'предложений'])}
            </span>
          </div>
          <SegmentedControl options={zoneOptions} value={zone} onChange={setZone} />
          <div className="mt-3 space-y-3">
            {list.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
            {allOffers.length === 0 && (
              <div className="card flex flex-col items-center px-6 py-8 text-center">
                <p className="text-headline">Пока никто не продаёт билеты</p>
                <p className="mt-1 text-subhead text-label-secondary">
                  Есть лишний билет на это событие? Выставьте его — цена не выше номинала.
                </p>
                <Button className="mt-4" variant="soft" icon="tab-sell" onClick={() => navigate('/sell/new')}>
                  Продать свой билет
                </Button>
              </div>
            )}
          </div>
        </section>

        <SafeDealNotice />
      </main>
    </>
  );
}
