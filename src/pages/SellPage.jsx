import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import TopBar from '@/components/layout/TopBar';
import ListingCard from '@/components/sell/ListingCard';
import Button from '@/components/ui/Button';
import { getEvent } from '@/data/mockData';
import { refreshListings } from '@/data/listingsStore';
import { useListings, useListingsError } from '@/hooks/useListings';
import { haptic } from '@/lib/telegram';

const RULES = [
  { icon: 'shield-check', title: 'Цена не выше номинала', text: 'Спекуляций нет — покупатели доверяют и покупают быстрее' },
  { icon: 'verified', title: 'Проверка ИИ за секунды', text: 'Загрузите PDF или фото — штрихкод сверим с организатором' },
  { icon: 'lock', title: 'Деньги после прохода', text: 'Оплата ждёт на эскроу-счёте и приходит вам по СБП' },
];

export default function SellPage() {
  const navigate = useNavigate();
  const listings = useListings();
  const loadError = useListingsError();

  useEffect(() => {
    refreshListings();
  }, []);
  const active = listings.filter((l) => l.status === 'active');
  const archived = listings.filter((l) => l.status !== 'active');

  const start = () => {
    haptic('medium');
    navigate('/sell/new');
  };

  return (
    <>
      <TopBar title="Продать" />
      <main className="space-y-3 px-gutter pb-6 pt-3">
        <section className="card p-5">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-success-mint text-[#002107]">
            <Icon name="tab-sell" className="h-7 w-7" />
          </span>
          <h1 className="mt-3 text-title2">Продайте лишний билет за пару минут</h1>
          <ul className="mt-4 space-y-3">
            {RULES.map((r) => (
              <li key={r.title} className="flex gap-3">
                <Icon name={r.icon} className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <span>
                  <span className="block text-subhead font-semibold">{r.title}</span>
                  <span className="block text-footnote text-label-secondary">{r.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <Button size="lg" block icon="tab-sell" className="mt-5" onClick={start}>
            Выставить билет
          </Button>
        </section>

        {loadError && (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-subhead text-danger">
            Не удалось загрузить объявления: {loadError}
          </p>
        )}

        {active.length > 0 && (
          <>
            <h2 className="px-4 pt-3 text-footnote font-medium uppercase tracking-wide text-label-secondary">
              В продаже ({active.length})
            </h2>
            {active.map((l) => (
              <ListingCard key={l.id} listing={l} event={getEvent(l.eventId)} />
            ))}
          </>
        )}

        {archived.length > 0 && (
          <>
            <h2 className="px-4 pt-3 text-footnote font-medium uppercase tracking-wide text-label-secondary">
              Сняты с продажи
            </h2>
            {archived.map((l) => (
              <ListingCard key={l.id} listing={l} event={getEvent(l.eventId)} />
            ))}
          </>
        )}
      </main>
    </>
  );
}
