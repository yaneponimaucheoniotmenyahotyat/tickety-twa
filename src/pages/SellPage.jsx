import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NEW_SELLER_ACTIVE_LIMIT } from '../../shared/listingRules.js';
import { confirmPhone } from '@/data/accountStore';
import { useServerAccount } from '@/hooks/useServerAccount';
import { apiEnabled } from '@/lib/api';
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

  // Допуск к продаже (только в режиме сервера — правила проверяет он же)
  const account = useServerAccount();
  const needsPhone = account.status === 'ok' && !account.user.phoneVerified;
  const sold = listings.filter((l) => l.status === 'sold').length;
  const atLimit = apiEnabled && sold === 0 && active.length >= NEW_SELLER_ACTIVE_LIMIT;
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState(null);
  const onConfirmPhone = async () => {
    setPhoneBusy(true);
    setPhoneError(await confirmPhone());
    setPhoneBusy(false);
  };

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
          {needsPhone ? (
            // Защита от мошенников: продавать можно только с номером, подтверждённым Telegram
            <div className="mt-5 rounded-2xl bg-brand-soft/60 p-4">
              <p className="text-subhead font-semibold">Подтвердите номер телефона</p>
              <p className="mt-1 text-footnote text-label-secondary">
                Так покупатели знают, что за объявлением стоит реальный человек. Номер увидит только Tickety —
                в объявлении его не будет.
              </p>
              {phoneError && <p className="mt-2 text-footnote text-danger">{phoneError}</p>}
              <Button size="lg" block icon="person" className="mt-3" loading={phoneBusy} onClick={onConfirmPhone}>
                Поделиться номером
              </Button>
            </div>
          ) : (
            <>
              <Button size="lg" block icon="tab-sell" className="mt-5" disabled={atLimit} onClick={start}>
                Выставить билет
              </Button>
              {atLimit && (
                <p className="mt-2 text-center text-footnote text-label-secondary">
                  Пока нет завершённых продаж, можно держать до {NEW_SELLER_ACTIVE_LIMIT} объявлений одновременно
                </p>
              )}
            </>
          )}
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
