import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import EscrowGuarantee from '@/components/checkout/EscrowGuarantee';
import OrderSummary from '@/components/checkout/OrderSummary';
import PaymentMethodItem from '@/components/checkout/PaymentMethodItem';
import PaymentSuccessSheet from '@/components/checkout/PaymentSuccessSheet';
import ReservationTimer from '@/components/checkout/ReservationTimer';
import Button from '@/components/ui/Button';
import DemoNotice from '@/components/ui/DemoNotice';
import { DEMO_MODE, PAYMENT_METHODS, RESERVATION_SECONDS, SERVICE_FEE_PERCENT, getEvent, getOffer } from '@/data/mockData';
import { useCountdown } from '@/hooks/useCountdown';
import { addTicket } from '@/hooks/useTickets';
import { formatPrice } from '@/lib/format';
import { createTicket } from '@/lib/tickets';
import { haptic, setClosingConfirmation } from '@/lib/telegram';

const PAYMENT_DELAY_MS = 1400; // имитация ответа банка

export default function CheckoutPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const offer = getOffer(offerId);
  const event = offer && getEvent(offer.eventId);

  const [method, setMethod] = useState('sbp');
  const [status, setStatus] = useState('idle'); // idle | paying | paid
  const [ticketId, setTicketId] = useState(null);
  const secondsLeft = useCountdown(RESERVATION_SECONDS, status !== 'paid');
  const expired = secondsLeft === 0 && status !== 'paid';

  // Пока идёт оплата, Telegram спросит подтверждение при закрытии Mini App
  useEffect(() => {
    setClosingConfirmation(status !== 'paid');
    return () => setClosingConfirmation(false);
  }, [status]);

  useEffect(() => {
    if (expired) haptic('warning');
  }, [expired]);

  const payTimer = useRef();
  useEffect(() => () => clearTimeout(payTimer.current), []);

  if (!offer || !event) return <Navigate to="/" replace />;
  // Свой билет купить нельзя (прямой переход по ссылке /checkout/<id своего объявления>)
  if (offer.own) return <Navigate to={`/event/${event.id}`} replace />;

  // Бета: оплата через Tickety ещё не подключена — не изображаем её на настоящих объявлениях
  if (!DEMO_MODE) {
    return (
      <>
        <TopBar title="Покупка" left={<BackLink />} />
        <main className="px-gutter pt-6">
          <section className="card flex flex-col items-center px-6 py-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon name="lock" className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-title3">Оплата скоро появится</h1>
            <p className="mt-2 text-subhead text-label-secondary">
              Сейчас идёт закрытая бета: покупка через Tickety с удержанием денег до прохода на событие ещё
              не подключена. Мы не будем принимать оплату, пока не сможем её защитить.
            </p>
            <Button className="mt-5" variant="plain" onClick={() => navigate(`/event/${event.id}`, { replace: true })}>
              Вернуться к событию
            </Button>
          </section>
        </main>
      </>
    );
  }

  const subtotal = offer.price * offer.quantity;
  const fee = Math.round((subtotal * SERVICE_FEE_PERCENT) / 100);
  const total = subtotal + fee;

  const pay = () => {
    haptic('medium');
    setStatus('paying');
    payTimer.current = setTimeout(() => {
      const ticket = createTicket({ event, offer, total, method });
      addTicket(ticket);
      setTicketId(ticket.id);
      setStatus('paid');
      haptic('success');
    }, PAYMENT_DELAY_MS);
  };

  return (
    <>
      <TopBar title="Оплата" left={<BackLink />} />

      <main className="space-y-3 px-gutter pb-[calc(150px+var(--app-safe-bottom))] pt-3">
        <DemoNotice>Это имитация оплаты — деньги не списываются.</DemoNotice>
        <div className="flex items-center justify-between">
          <ReservationTimer seconds={status === 'paid' ? RESERVATION_SECONDS : secondsLeft} />

        </div>

        <OrderSummary
          event={event}
          offer={offer}
          subtotal={subtotal}
          fee={fee}
          feePercent={SERVICE_FEE_PERCENT}
          total={total}
        />

        <h2 className="px-1 pt-3 text-footnote font-medium uppercase tracking-wide text-label-secondary">
          Способ оплаты
        </h2>
        <div role="radiogroup" aria-label="Способ оплаты" className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <PaymentMethodItem key={m.id} method={m} selected={method === m.id} onSelect={setMethod} />
          ))}
        </div>

        <EscrowGuarantee />
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-separator/60 bg-bg/90 px-gutter pb-[calc(12px+var(--app-safe-bottom))] pt-3 backdrop-blur-xl">
        {expired ? (
          <Button size="lg" block variant="plain" onClick={() => navigate(`/event/${event.id}`, { replace: true })}>
            Бронь истекла — выбрать заново
          </Button>
        ) : (
          <Button size="lg" block icon="lock" loading={status === 'paying'} disabled={status === 'paid'} onClick={pay}>
            {status === 'paying' ? 'Связываемся с банком…' : `Оплатить ${formatPrice(total)}`}
          </Button>
        )}
        <p className="mt-2 text-center text-caption2 text-label-tertiary">
          Нажимая «Оплатить», вы соглашаетесь с условиями сервиса, регламентом возврата и офертой
          безопасных расчётов.
        </p>
      </footer>

      <PaymentSuccessSheet
        open={status === 'paid'}
        total={total}
        eventTitle={event.title}
        onClose={() => navigate(`/event/${event.id}`, { replace: true })}
        onTickets={() => navigate(`/tickets/${ticketId}`, { replace: true })}
      />
    </>
  );
}
