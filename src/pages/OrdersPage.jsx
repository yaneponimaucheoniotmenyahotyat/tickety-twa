import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import EventCover from '@/components/event/EventCover';
import Badge from '@/components/ui/Badge';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import PageLoader from '@/components/ui/PageLoader';
import {
  absoluteApiUrl,
  cancelOrder,
  confirmOrder,
  disputeOrder,
  fetchOrder,
  fetchOrders,
  reportPaid,
  ticketLink,
} from '@/lib/api';
import { formatEventDate, formatPrice } from '@/lib/format';
import { confirmDialog, haptic, openLink } from '@/lib/telegram';

// Статусы заказа глазами покупателя. Неоплаченный заказ после «Я перевёл» — «Проверяем оплату».
const statusOf = (o) => (o.status === 'pending' && o.buyerReportedAt ? ORDER_STATUS.checking : ORDER_STATUS[o.status]);
export const ORDER_STATUS = {
  checking: { label: 'Проверяем оплату', tone: 'brand' },
  pending: { label: 'Ждёт оплаты', tone: 'neutral' },
  paid: { label: 'Оплачен', tone: 'success' },
  disputed: { label: 'Спор', tone: 'danger' },
  completed: { label: 'Завершён', tone: 'neutral' },
  refunded: { label: 'Деньги возвращены', tone: 'neutral' },
  cancelled: { label: 'Отменён', tone: 'neutral' },
};

function holdText(order) {
  switch (order.status) {
    case 'paid':
      return `${formatPrice(order.amount)} удерживаются Tickety до ${formatEventDate(order.holdUntil)}. Если билет не сработает — откройте спор, и мы вернём деньги.`;
    case 'disputed':
      return `Спор открыт: «${order.disputeReason}». Деньги заморожены, пока команда Tickety разбирается — ответ придёт в чат с ботом.`;
    case 'completed':
      return 'Сделка завершена: деньги переданы продавцу.';
    case 'refunded':
      return `${formatPrice(order.amount)} возвращены${order.resolution ? `: ${order.resolution}` : ''}.`;
    default:
      return '';
  }
}

// Список покупок в «Моих билетах» (бета, с сервером)
export function OrdersList() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    fetchOrders()
      .then(({ orders }) => setState({ status: 'ok', orders }))
      .catch((error) => setState({ status: 'error', error }));
  }, []);

  if (state.status === 'loading') return <PageLoader />;
  if (state.status === 'error') return <p className="py-10 text-center text-subhead text-danger">{state.error.message}</p>;
  if (!state.orders.length) {
    return (
      <div className="card flex flex-col items-center px-6 py-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
          <Icon name="tab-tickets" className="h-8 w-8" />
        </span>
        <p className="mt-3 text-headline">Здесь появятся купленные билеты</p>
        <p className="mt-1 text-subhead text-label-secondary">Деньги удерживаются до события — продавец получит их только после</p>
        <Button className="mt-5" iconRight="chevron-right" onClick={() => navigate('/')}>
          Найти события
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {state.orders.map((o) => (
        <button key={o.id} type="button" onClick={() => navigate(`/orders/${o.id}`)} className="card pressable flex w-full gap-3 p-4 text-left">
          <EventCover event={{ ...o.event, cover: o.event.cover ?? ['#1B2F5D', '#3D7BFF', '#F47C20'] }} className="h-14 w-14 shrink-0 rounded-xl" />
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2">
              <span className="truncate text-headline">{o.event.title}</span>
              <Badge size="sm" tone={statusOf(o).tone} className="shrink-0">
                {statusOf(o).label}
              </Badge>
            </span>
            <span className="block truncate text-footnote text-label-secondary">
              {o.event.date ? `${formatEventDate(o.event.date)} • ` : ''}
              {o.title}
            </span>
            <span className="block text-subhead">
              <b>{formatPrice(o.amount)}</b>
              {o.quantity > 1 && <span className="text-label-secondary"> • {o.quantity} билета</span>}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

// Копирование в буфер: в WebView Telegram clipboard API бывает недоступен — тогда выделяем текст
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    haptic('success');
    return true;
  } catch {
    return false;
  }
}

function CopyRow({ label, value, mono }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-caption1 text-label-tertiary">{label}</span>
        <span className={`block select-all break-words text-body ${mono ? 'font-mono font-semibold tracking-wider' : ''}`}>{value}</span>
      </span>
      <button
        type="button"
        onClick={async () => setCopied(await copy(value))}
        className="pressable shrink-0 rounded-lg bg-fill px-3 py-1.5 text-footnote font-semibold text-brand"
      >
        {copied ? 'Скопировано' : 'Копировать'}
      </button>
    </div>
  );
}

// Ручная оплата: куда перевести, с каким кодом, и «Я перевёл»
function ManualPayment({ order, busy, onReported, onCancel }) {
  const until = new Date(order.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (order.buyerReportedAt) {
    return (
      <section className="card p-4">
        <h2 className="text-headline">Проверяем ваш перевод</h2>
        <p className="mt-1 text-subhead text-label-secondary">
          Как только Tickety увидит поступление с кодом <b>{order.paymentCode}</b>, бот напишет вам, и здесь появится
          файл билета. Бронь сохраняется, пока мы проверяем.
        </p>
      </section>
    );
  }
  return (
    <section className="card p-4">
      <h2 className="text-headline">Переведите {formatPrice(order.payment.amount)}</h2>
      <p className="text-footnote text-label-secondary">Бронь до {until}. Деньги хранятся у Tickety до события.</p>
      <div className="mt-2 divide-y divide-separator">
        <CopyRow label="Сумма" value={String(order.payment.amount)} />
        <CopyRow label="Куда (СБП)" value={order.payment.details} />
        <CopyRow label="Комментарий к переводу — обязательно" value={order.payment.code} mono />
      </div>
      <p className="mt-2 text-footnote text-label-secondary">
        Переводите ровно эту сумму и укажите код в комментарии — по нему мы найдём ваш платёж. Не переводите продавцу
        напрямую: тогда Tickety не сможет вернуть деньги.
      </p>
      <Button size="lg" block className="mt-4" loading={busy === 'report'} onClick={onReported}>
        Я перевёл
      </Button>
      <button type="button" onClick={onCancel} className="mt-3 w-full text-center text-footnote text-label-tertiary">
        Отменить бронь
      </button>
    </section>
  );
}

const DISPUTE_REASONS = ['QR-код не прошёл на входе', 'Билет на другое событие или места', 'Файл не открывается', 'Продавец просит доплату'];

// Купленный билет: файл, статус денег, «Я прошёл» и спор
export function OrderPage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchOrder(id)
      .then(({ order }) => setState({ status: 'ok', order }))
      .catch((e) => setState({ status: 'error', error: e }));
  }, [id]);

  const run = async (name, work) => {
    setBusy(name);
    setError(null);
    try {
      const result = await work();
      if (result?.order) setState({ status: 'ok', order: result.order });
      haptic('success');
    } catch (e) {
      haptic('error');
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const openTicket = () =>
    run('file', async () => {
      const { url } = await ticketLink(id);
      openLink(absoluteApiUrl(url));
    });

  const confirm = async () => {
    const ok = await confirmDialog('Подтвердить, что вы прошли на событие? Деньги сразу уйдут продавцу, открыть спор будет нельзя.');
    if (ok) await run('confirm', () => confirmOrder(id));
  };

  const dispute = () =>
    run('dispute', async () => {
      const result = await disputeOrder(id, reason.trim());
      setDisputeOpen(false);
      return result;
    });

  const reported = async () => {
    const ok = await confirmDialog(`Вы перевели ${formatPrice(state.order.payment.amount)} с комментарием ${state.order.payment.code}?`);
    if (ok) await run('report', () => reportPaid(id));
  };
  const cancel = async () => {
    if (await confirmDialog('Отменить бронь? Билет вернётся в продажу.')) await run('cancel', () => cancelOrder(id));
  };

  const order = state.order;
  const canUse = order && ['paid', 'disputed', 'completed'].includes(order.status);

  return (
    <>
      <TopBar title="Билет" left={<BackLink label="Мои билеты" />} />
      {state.status === 'loading' ? (
        <PageLoader />
      ) : state.status === 'error' ? (
        <p className="px-gutter py-10 text-center text-subhead text-danger">{state.error.message}</p>
      ) : (
        <main className="space-y-3 px-gutter pb-8 pt-3">
          <EventCover event={{ ...order.event, cover: order.event.cover ?? ['#1B2F5D', '#3D7BFF', '#F47C20'] }} className="flex h-36 flex-col justify-end rounded-2xl p-4">
            <p className="text-title3 text-white drop-shadow">{order.event.title}</p>
            {order.event.date && (
              <p className="text-subhead text-white/85">
                {formatEventDate(order.event.date)} • {order.event.venue}
              </p>
            )}
          </EventCover>

          <section className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-headline">{order.title}</h2>
              <Badge size="sm" tone={statusOf(order).tone}>
                {statusOf(order).label}
              </Badge>
            </div>
            <p className="mt-1 text-footnote text-label-secondary">
              {order.quantity > 1 ? `${order.quantity} билета • ` : ''}продавец {order.seller.name} • {formatPrice(order.amount)}
              {order.provider === 'test' ? ' (тестовая оплата)' : order.provider === 'manual' ? ' • перевод по СБП' : ''}
            </p>
            {canUse && (
              <Button block size="lg" icon="qr" className="mt-4" loading={busy === 'file'} onClick={openTicket}>
                Открыть файл билета
              </Button>
            )}
            {canUse && (
              <p className="mt-2 text-center text-caption1 text-label-tertiary">
                Покажите код из файла на входе. Не пересылайте файл другим людям.
              </p>
            )}
          </section>

          {order.status === 'pending' && order.payment && (
            <ManualPayment order={order} busy={busy} onReported={reported} onCancel={cancel} />
          )}

          {holdText(order) && (
            <section className="card flex gap-3 p-4">
              <Icon name="shield-heart" className="mt-0.5 h-6 w-6 shrink-0 text-success" />
              <p className="text-subhead">{holdText(order)}</p>
            </section>
          )}

          {error && <p className="text-center text-footnote text-danger">{error}</p>}

          {order.status === 'paid' && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="soft" loading={busy === 'confirm'} onClick={confirm}>
                Я прошёл
              </Button>
              <Button variant="plain" className="text-danger" onClick={() => setDisputeOpen(true)}>
                Проблема с билетом
              </Button>
            </div>
          )}
        </main>
      )}

      <BottomSheet
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        header={<h2 className="text-title3">Проблема с билетом</h2>}
        footer={
          <Button size="lg" block loading={busy === 'dispute'} disabled={reason.trim().length < 3} onClick={dispute}>
            Открыть спор
          </Button>
        }
      >
        <p className="mb-2 text-footnote text-label-secondary">
          Деньги останутся у Tickety, пока команда разбирается. Продавец их не получит.
        </p>
        <div className="flex flex-wrap gap-2">
          {DISPUTE_REASONS.map((r) => (
            <Chip key={r} size="sm" variant="brand" active={reason === r} onClick={() => setReason(r)}>
              {r}
            </Chip>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          placeholder="Опишите, что случилось"
          rows={3}
          className="mt-3 w-full rounded-xl bg-fill px-3 py-2 text-body outline-none"
        />
      </BottomSheet>
    </>
  );
}
