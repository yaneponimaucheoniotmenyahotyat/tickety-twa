import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import OrderSummary from '@/components/checkout/OrderSummary';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import PageLoader from '@/components/ui/PageLoader';
import { refreshListings } from '@/data/listingsStore';
import { usePaymentsMode } from '@/hooks/usePayments';
import { createOrder, payOrder } from '@/lib/api';
import { formatEventDate, formatPrice } from '@/lib/format';
import { haptic } from '@/lib/telegram';

const HOLD_STEPS = [
  ['Оплата', 'Деньги поступают Tickety, продавец их пока не получает.'],
  ['Билет', 'Файл билета сразу появится в «Моих билетах».'],
  ['Удержание', 'Деньги ждут до суток после начала события. Не прошли по билету — откройте спор, и мы вернём деньги.'],
  ['Продавцу', 'Нет спора или вы подтвердили проход — деньги уходят продавцу.'],
];

// Бета-оплата: бронь + тестовый платёж на сервере. Механика удержания настоящая,
// деньги — нет: платёжный сервис подключим, когда будет договор.
export default function BetaCheckout({ event, offer }) {
  const navigate = useNavigate();
  const payments = usePaymentsMode();
  const [state, setState] = useState({ status: 'idle' }); // idle | paying | paid | error
  const total = offer.price * offer.quantity;

  const manual = payments === 'manual';

  const pay = async () => {
    haptic('medium');
    setState({ status: 'paying' });
    try {
      const { order } = await createOrder(offer.id);
      // Ручной режим: бронь есть — дальше реквизиты и «Я перевёл» на странице заказа
      if (manual) {
        refreshListings();
        navigate(`/orders/${order.id}`, { replace: true });
        return;
      }
      const { order: paid } = await payOrder(order.id);
      haptic('success');
      setState({ status: 'paid', order: paid });
      refreshListings();
    } catch (e) {
      haptic('error');
      setState({ status: 'error', message: e.message, code: e.code });
    }
  };

  if (payments === 'loading') return <PageLoader />;

  if (payments !== 'test' && payments !== 'manual') {
    return (
      <>
        <TopBar title="Покупка" left={<BackLink />} />
        <main className="px-gutter pt-6">
          <section className="card flex flex-col items-center px-6 py-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon name="lock" className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-title3">Оплата сейчас недоступна</h1>
            <p className="mt-2 text-subhead text-label-secondary">Попробуйте позже.</p>
            <Button className="mt-5" variant="plain" onClick={() => navigate(`/event/${event.id}`, { replace: true })}>
              Вернуться к событию
            </Button>
          </section>
        </main>
      </>
    );
  }

  const gone = state.status === 'error' && ['listing_taken', 'listing_not_found', 'listing_gone'].includes(state.code);

  return (
    <>
      <TopBar title="Оплата" left={<BackLink />} />
      <main className="space-y-3 px-gutter pb-[calc(150px+var(--app-safe-bottom))] pt-3">
        {manual ? (
          <div className="rounded-2xl bg-brand-soft/60 px-4 py-3 text-subhead">
            <b>Оплата переводом по СБП.</b> После брони покажем реквизиты Tickety и код для комментария. Деньги
            хранятся у Tickety до события — продавец получит их, только если с билетом всё в порядке.
          </div>
        ) : (
          <div className="rounded-2xl bg-[#FFF4E5] px-4 py-3 text-subhead text-[#8A4B00] dark:bg-[#3A2A12] dark:text-[#FFC266]">
            <b>Бета: тестовая оплата.</b> Деньги не списываются. Всё остальное — бронь, удержание до события,
            спор и выплата продавцу — работает по-настоящему.
          </div>
        )}

        <OrderSummary event={event} offer={offer} subtotal={total} fee={0} feePercent={0} total={total} />

        <section className="card p-4">
          <h2 className="text-headline">Как защищены деньги</h2>
          <ol className="mt-3 space-y-3">
            {HOLD_STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-caption1 font-bold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-subhead font-semibold">{title}</span>
                  <span className="block text-footnote text-label-secondary">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-separator/60 bg-bg/90 px-gutter pb-[calc(12px+var(--app-safe-bottom))] pt-3 backdrop-blur-xl">
        {state.status === 'error' && <p className="mb-2 text-center text-footnote text-danger">{state.message}</p>}
        {gone ? (
          <Button size="lg" block variant="plain" onClick={() => navigate(`/event/${event.id}`, { replace: true })}>
            Выбрать другой билет
          </Button>
        ) : (
          <Button size="lg" block icon="lock" loading={state.status === 'paying'} disabled={state.status === 'paid'} onClick={pay}>
            {state.status === 'paying'
              ? manual
                ? 'Бронируем…'
                : 'Оплачиваем…'
              : manual
                ? `Забронировать и оплатить ${formatPrice(total)}`
                : `Оплатить ${formatPrice(total)} (тест)`}
          </Button>
        )}
      </footer>

      <BottomSheet
        open={state.status === 'paid'}
        onClose={() => navigate(`/event/${event.id}`, { replace: true })}
        footer={
          <Button size="lg" block onClick={() => navigate(`/orders/${state.order.id}`, { replace: true })}>
            Открыть билет
          </Button>
        }
      >
        {state.order && (
          <div className="flex flex-col items-center pb-2 pt-4 text-center">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-success-soft text-success">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-success text-white">
                <Icon name="check" className="h-12 w-12" />
              </span>
            </span>
            <h2 className="mt-4 text-title2">Оплачено (тест)</h2>
            <p className="mt-1 text-subhead text-label-secondary">
              {formatPrice(state.order.amount)} удерживаются Tickety до {formatEventDate(state.order.holdUntil)} — продавец
              получит их, если с билетом всё в порядке.
            </p>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
