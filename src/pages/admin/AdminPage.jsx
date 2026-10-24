import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import EventCover from '@/components/event/EventCover';
import Badge from '@/components/ui/Badge';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import PageLoader from '@/components/ui/PageLoader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { refreshEvents } from '@/data/eventsStore';
import { refreshListings } from '@/data/listingsStore';
import { useServerAccount } from '@/hooks/useServerAccount';
import { THREAD_STATUS } from '@/components/support/Conversation';
import {
  adminAddStaff,
  adminBlockUser,
  adminDeleteEvent,
  adminEvents,
  adminListings,
  adminConfirmPayment,
  adminOrders,
  adminPayoutPaid,
  adminPayoutReject,
  adminPayouts,
  adminRefundOrder,
  adminRejectPayment,
  adminReleaseOrder,
  adminPublishEvent,
  adminRemoveListing,
  adminRemoveStaff,
  adminStaff,
  adminSupportThreads,
  adminUnblockUser,
  adminWithdrawEvent,
  apiEnabled,
} from '@/lib/api';
import { formatEventDate, formatPrice, plural } from '@/lib/format';
import { confirmDialog, haptic, openTelegramLink } from '@/lib/telegram';

// Доступ к админке решает сервер (ADMIN_IDS); здесь — только чтобы не показывать пустые экраны
export function AdminGate({ account, children }) {
  if (!apiEnabled) {
    return <p className="px-gutter py-10 text-center text-subhead text-label-secondary">Админка работает только с сервером</p>;
  }
  if (account.status === 'loading') return <PageLoader />;
  if (account.status === 'error') {
    return <p className="px-gutter py-10 text-center text-subhead text-danger">{account.error.message}</p>;
  }
  if (!account.user.isAdmin) {
    return <p className="px-gutter py-10 text-center text-subhead text-label-secondary">Нужны права администратора</p>;
  }
  return children;
}

function useLoad(load, deps) {
  const [state, setState] = useState({ status: 'loading' });
  const reload = useCallback(() => {
    load()
      .then((data) => setState({ status: 'ok', data }))
      .catch((error) => setState({ status: 'error', error }));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reload, [reload]);
  return [state, reload];
}

const WITHDRAW_REASONS = ['Событие отменено', 'Событие перенесено', 'Ошибка в данных события'];

// Действия с событием из списка: изменить, снять с витрины (с объявлениями), вернуть, удалить
function EventActionsSheet({ event, onClose, onChanged }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('menu'); // menu | withdraw
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    setMode('menu');
    setReason('');
    setError(null);
  }, [event]);

  const run = async (work) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      haptic('success');
      onChanged();
    } catch (e) {
      haptic('error');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog(`Удалить «${event.title}» насовсем?`))) return;
    await run(() => adminDeleteEvent(event.id));
  };

  const row = 'pressable flex h-12 w-full items-center rounded-xl bg-fill px-4 text-body font-semibold';

  return (
    <BottomSheet
      open={Boolean(event)}
      onClose={onClose}
      header={
        event && (
          <div>
            <h2 className="truncate text-title3">{event.title}</h2>
            <p className="text-footnote text-label-secondary">
              {event.status === 'hidden' ? 'Скрыто с витрины' : 'На витрине'} • в продаже {event.activeListings}
            </p>
          </div>
        )
      }
      footer={
        mode === 'withdraw' && (
          <div>
            {error && <p className="mb-2 text-center text-footnote text-danger">{error}</p>}
            <Button
              size="lg"
              block
              loading={busy}
              disabled={reason.trim().length < 3}
              onClick={() => run(() => adminWithdrawEvent(event.id, reason.trim()))}
            >
              Снять с витрины
            </Button>
          </div>
        )
      }
    >
      {event && mode === 'menu' && (
        <div className="space-y-2 pb-2">
          <button type="button" className={row} onClick={() => navigate(`/admin/events/${event.id}`)}>
            Изменить событие и прайс
          </button>
          {event.status === 'published' ? (
            <button type="button" className={`${row} text-danger`} onClick={() => setMode('withdraw')}>
              Снять с витрины…
            </button>
          ) : (
            <button type="button" className={row} disabled={busy} onClick={() => run(() => adminPublishEvent(event.id))}>
              Вернуть на витрину
            </button>
          )}
          {event.totalListings === 0 ? (
            <button type="button" className={`${row} text-danger`} disabled={busy} onClick={remove}>
              Удалить событие
            </button>
          ) : (
            <p className="px-1 text-caption1 text-label-tertiary">
              На событие уже выставляли билеты — удалить нельзя, только снять с витрины.
            </p>
          )}
          {error && <p className="text-center text-footnote text-danger">{error}</p>}
        </div>
      )}
      {event && mode === 'withdraw' && (
        <div>
          <p className="mb-2 text-footnote text-label-secondary">
            Событие пропадёт с витрины
            {event.activeListings > 0 ? `, а ${event.activeListings} ${plural(event.activeListings, ['объявление', 'объявления', 'объявлений'])} снимутся с продажи. Причину увидят продавцы` : ''}.
          </p>
          <div className="flex flex-wrap gap-2">
            {WITHDRAW_REASONS.map((r) => (
              <Chip key={r} size="sm" variant="brand" active={reason === r} onClick={() => setReason(r)}>
                {r}
              </Chip>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            placeholder="Или своими словами"
            rows={2}
            className="mt-3 w-full rounded-xl bg-fill px-3 py-2 text-body outline-none"
          />
        </div>
      )}
    </BottomSheet>
  );
}

function EventsTab() {
  const navigate = useNavigate();
  const [state, reload] = useLoad(adminEvents, []);
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-3">
      <Button size="lg" block onClick={() => navigate('/admin/events/new')}>
        + Добавить событие
      </Button>
      {state.status === 'loading' && <PageLoader />}
      {state.status === 'error' && <p className="text-center text-subhead text-danger">{state.error.message}</p>}
      {state.status === 'ok' && state.data.events.length === 0 && (
        <p className="px-4 py-6 text-center text-subhead text-label-secondary">
          Событий пока нет. Добавьте первое — с прайсом зон с сайта организатора.
        </p>
      )}
      {state.status === 'ok' && state.data.events.length > 0 && (
        <div className="card divide-y divide-separator overflow-hidden">
          {state.data.events.map((e) => {
            const past = new Date(e.date) < Date.now();
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelected(e)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-fill/60 ${past || e.status === 'hidden' ? 'opacity-60' : ''}`}
              >
                <EventCover event={e} className="h-11 w-11 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-headline">{e.title}</span>
                  <span className="block truncate text-footnote text-label-secondary">
                    {formatEventDate(e.date)} • {e.city} • {e.zones.length}{' '}
                    {plural(e.zones.length, ['зона', 'зоны', 'зон'])}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {e.status === 'hidden' && <Badge size="sm">Скрыто</Badge>}
                  {past && <Badge size="sm">Прошло</Badge>}
                  {e.activeListings > 0 && (
                    <Badge size="sm" tone="success">
                      {e.activeListings} в продаже
                    </Badge>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <EventActionsSheet
        event={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null);
          reload();
          refreshEvents();
          refreshListings();
        }}
      />
    </div>
  );
}

// ---- Обращения ----
function SupportTab() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('open');
  const [state] = useLoad(() => adminSupportThreads(status), [status]);
  const threads = state.status === 'ok' ? state.data.threads : [];

  return (
    <div className="space-y-3">
      <SegmentedControl
        value={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: 'Ждут ответа' },
          { value: 'answered', label: 'Отвечены' },
          { value: 'closed', label: 'Закрыты' },
        ]}
      />
      {state.status === 'loading' && <PageLoader />}
      {state.status === 'error' && <p className="text-center text-subhead text-danger">{state.error.message}</p>}
      {state.status === 'ok' && threads.length === 0 && (
        <p className="px-4 py-6 text-center text-subhead text-label-secondary">Пусто</p>
      )}
      {threads.length > 0 && (
        <div className="card divide-y divide-separator overflow-hidden">
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/admin/support/${t.id}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-fill/60"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-headline">{t.user.name}</span>
                  {t.category === 'complaint' && (
                    <Badge size="sm" tone="danger">
                      Жалоба
                    </Badge>
                  )}
                </span>
                <span className="block truncate text-footnote text-label-secondary">
                  {t.categoryLabel} • {t.lastMessage?.body}
                </span>
              </span>
              <span className="shrink-0 text-caption1 text-label-tertiary">
                {new Date(t.updatedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Сделки и споры ----
// awaiting и «Выплаты» — ручные переводы, только у владельца (право payments)
const DEAL_STATUS = {
  awaiting: { label: 'Оплата', tone: 'brand', money: true },
  disputed: { label: 'Спор', tone: 'danger' },
  paid: { label: 'Удерживается', tone: 'brand' },
  completed: { label: 'Продавцу', tone: 'success' },
  refunded: { label: 'Возврат', tone: 'neutral' },
};

const ACTION_TEXT = {
  refund: { title: 'Вернуть деньги покупателю', button: 'Вернуть деньги', hint: 'Например: билет недействителен, продавец не ответил' },
  release: { title: 'Отдать деньги продавцу', button: 'Отдать продавцу', hint: 'Например: проход подтверждён' },
  rejectPayment: { title: 'Перевод не пришёл', button: 'Снять бронь', hint: 'Например: поступления с этим кодом нет' },
  rejectPayout: { title: 'Отклонить выплату', button: 'Отклонить', hint: 'Например: неверный банк, напишите в поддержку' },
};

// Заявки продавцов на вывод: владелец переводит по СБП и отмечает
function PayoutsList({ onAction, version }) {
  const [state, reload] = useLoad(() => adminPayouts('requested'), [version]);
  const paid = async (payout) => {
    if (!(await confirmDialog(`Вы перевели ${formatPrice(payout.amount)}: ${payout.details}?`))) return;
    try {
      await adminPayoutPaid(payout.id);
      haptic('success');
      reload();
    } catch (e) {
      await confirmDialog(e.message);
    }
  };
  if (state.status === 'loading') return <PageLoader />;
  if (state.status === 'error') return <p className="text-center text-subhead text-danger">{state.error.message}</p>;
  if (!state.data.payouts.length) return <p className="px-4 py-6 text-center text-subhead text-label-secondary">Заявок нет</p>;
  return state.data.payouts.map((p) => (
    <article key={p.id} className="card p-4">
      <p className="text-title3">{formatPrice(p.amount)}</p>
      <p className="select-all text-subhead">{p.details}</p>
      <p className="text-footnote text-label-secondary">
        Продавец {p.seller.name} (ID {p.seller.id}) • {new Date(p.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => paid(p)} className="pressable h-9 rounded-xl bg-success-soft text-footnote font-semibold text-success">
          Перевёл
        </button>
        <button type="button" onClick={() => onAction({ type: 'rejectPayout', payout: p })} className="pressable h-9 rounded-xl bg-fill text-footnote font-semibold">
          Отклонить
        </button>
      </div>
    </article>
  ));
}

function DealsTab() {
  const account = useServerAccount();
  const canMoney = account.status === 'ok' && account.user.staff?.permissions.includes('payments');
  const [status, setStatus] = useState(canMoney ? 'awaiting' : 'disputed');
  const [version, setVersion] = useState(0);
  const [state, reload] = useLoad(() => (status === 'payouts' ? Promise.resolve({ orders: [] }) : adminOrders(status)), [status, version]);
  const [action, setAction] = useState(null); // { type, order | payout }
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const orders = state.status === 'ok' ? state.data.orders : [];

  const open = (type, order) => {
    setAction({ type, order });
    setReason('');
    setError(null);
  };
  const openPayout = (a) => {
    setAction(a);
    setReason('');
    setError(null);
  };
  const confirmPayment = async (order) => {
    if (!(await confirmDialog(`Поступило ${formatPrice(order.amount)} с комментарием ${order.paymentCode}?`))) return;
    try {
      await adminConfirmPayment(order.id);
      haptic('success');
      reload();
    } catch (e) {
      await confirmDialog(e.message);
    }
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const why = reason.trim();
      if (action.type === 'refund') await adminRefundOrder(action.order.id, why);
      else if (action.type === 'release') await adminReleaseOrder(action.order.id, why);
      else if (action.type === 'rejectPayment') await adminRejectPayment(action.order.id, why);
      else await adminPayoutReject(action.payout.id, why);
      haptic('success');
      setAction(null);
      setVersion((v) => v + 1);
      reload();
    } catch (e) {
      haptic('error');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const person = (p) => (
    <button
      type="button"
      onClick={() => p.username && openTelegramLink(`https://t.me/${p.username}`)}
      className={p.username ? 'font-semibold text-brand' : 'font-semibold'}
    >
      {p.name}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="chips-scroll -mx-gutter px-gutter">
        {[
          ...Object.entries(DEAL_STATUS).filter(([, s]) => !s.money || canMoney),
          ...(canMoney ? [['payouts', { label: 'Выплаты' }]] : []),
        ].map(([value, s]) => (
          <Chip key={value} size="sm" variant="brand" active={status === value} onClick={() => setStatus(value)}>
            {s.label}
          </Chip>
        ))}
      </div>
      {status === 'payouts' && <PayoutsList onAction={openPayout} version={version} />}
      {status !== 'payouts' && state.status === 'loading' && <PageLoader />}
      {state.status === 'error' && <p className="text-center text-subhead text-danger">{state.error.message}</p>}
      {status !== 'payouts' && state.status === 'ok' && orders.length === 0 && (
        <p className="px-4 py-6 text-center text-subhead text-label-secondary">Пусто</p>
      )}
      {status !== 'payouts' && orders.map((o) => (
        <article key={o.id} className="card p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-footnote text-label-secondary">{o.event.title}</p>
            <Badge size="sm" tone={DEAL_STATUS[status === 'awaiting' ? 'awaiting' : o.status].tone}>
              {DEAL_STATUS[status === 'awaiting' ? 'awaiting' : o.status].label}
            </Badge>
          </div>
          <p className="text-headline">{o.title}</p>
          <p className="text-subhead">
            <b>{formatPrice(o.amount)}</b>
            <span className="text-label-secondary">
              {status === 'awaiting'
                ? ` • код ${o.paymentCode} • «перевёл» в ${new Date(o.buyerReportedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
                : ` • ${o.provider === 'test' ? 'тест' : o.provider === 'manual' ? 'перевод' : o.provider} • удержание до ${formatEventDate(o.holdUntil)}`}
            </span>
          </p>
          <p className="mt-1 text-footnote text-label-secondary">
            Покупатель {person(o.buyer)} (ID {o.buyer.id}) • продавец {person(o.seller)} (ID {o.seller.id})
          </p>
          {o.disputeReason && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-footnote text-danger">Спор: {o.disputeReason}</p>}
          {o.resolution && o.status !== 'paid' && o.status !== 'disputed' && (
            <p className="mt-2 text-footnote text-label-secondary">Итог: {o.resolution}</p>
          )}
          {o.provider === 'manual' && o.buyer.phone && (o.status === 'paid' || o.status === 'disputed') && (
            <p className="mt-1 text-footnote text-label-secondary">Для возврата: СБП {o.buyer.phone}</p>
          )}
          {status === 'awaiting' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => confirmPayment(o)} className="pressable h-9 rounded-xl bg-success-soft text-footnote font-semibold text-success">
                Деньги пришли
              </button>
              <button type="button" onClick={() => open('rejectPayment', o)} className="pressable h-9 rounded-xl bg-fill text-footnote font-semibold">
                Не пришли
              </button>
            </div>
          )}
          {(o.status === 'paid' || o.status === 'disputed') && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => open('refund', o)} className="pressable h-9 rounded-xl bg-danger-soft text-footnote font-semibold text-danger">
                Вернуть покупателю
              </button>
              <button type="button" onClick={() => open('release', o)} className="pressable h-9 rounded-xl bg-fill text-footnote font-semibold">
                Отдать продавцу
              </button>
            </div>
          )}
        </article>
      ))}

      <BottomSheet
        open={Boolean(action)}
        onClose={() => setAction(null)}
        header={
          action && (
            <div>
              <h2 className="text-title3">{ACTION_TEXT[action.type].title}</h2>
              <p className="text-footnote text-label-secondary">
                {formatPrice((action.order ?? action.payout).amount)}
                {action.order ? ` • ${action.order.title}` : ` • ${action.payout.details}`}
                {action.type === 'refund' ? ' • объявление снимется с продажи' : ''}
              </p>
            </div>
          )
        }
        footer={
          <div>
            {error && <p className="mb-2 text-center text-footnote text-danger">{error}</p>}
            <Button size="lg" block loading={busy} disabled={reason.trim().length < 3} onClick={submit}>
              {action && ACTION_TEXT[action.type].button}
            </Button>
          </div>
        }
      >
        <p className="mb-2 text-footnote text-label-secondary">Причину увидит пользователь — в приложении и сообщением от бота</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          placeholder={action ? ACTION_TEXT[action.type].hint : ''}
          rows={3}
          className="w-full rounded-xl bg-fill px-3 py-2 text-body outline-none"
        />
      </BottomSheet>
    </div>
  );
}

// ---- Команда (только владелец) ----
function TeamTab() {
  const [state, reload] = useLoad(adminStaff, []);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('moderator');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminAddStaff(Number(userId), role);
      haptic('success');
      setUserId('');
      reload();
    } catch (e) {
      haptic('error');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member, r) => {
    if (!(await confirmDialog(`Забрать роль «${state.data.roles[r]}» у ${member.name ?? member.id}?`))) return;
    try {
      await adminRemoveStaff(member.id, r);
      reload();
    } catch (e) {
      await confirmDialog(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <section className="card space-y-3 p-4">
        <div>
          <h2 className="text-headline">Добавить в команду</h2>
          <p className="text-footnote text-label-secondary">
            Модератор — события и объявления, поддержка — обращения. Человек должен хотя бы раз открыть Tickety;
            его Telegram ID можно узнать, например, у бота @userinfobot.
          </p>
        </div>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value.replace(/\D/g, '').slice(0, 15))}
          inputMode="numeric"
          placeholder="Telegram ID"
          className="h-11 w-full rounded-xl bg-fill px-3 text-body outline-none placeholder:text-label-tertiary"
        />
        <SegmentedControl
          value={role}
          onChange={setRole}
          options={[
            { value: 'moderator', label: 'Модератор' },
            { value: 'support', label: 'Поддержка' },
          ]}
        />
        {error && <p className="text-footnote text-danger">{error}</p>}
        <Button block loading={busy} disabled={!userId} onClick={add}>
          Выдать роль
        </Button>
      </section>

      {state.status === 'loading' && <PageLoader />}
      {state.status === 'ok' && (
        <div className="card divide-y divide-separator overflow-hidden">
          {state.data.staff.map((m) => (
            <div key={m.id} className="px-4 py-3">
              <p className="truncate text-headline">
                {m.name ?? 'Ещё не открывал Tickety'}
                {m.username && <span className="font-normal text-label-secondary"> @{m.username}</span>}
              </p>
              <p className="text-caption1 text-label-tertiary">ID {m.id}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {m.owner && (
                  <Badge size="sm" tone="brand">
                    Владелец • задаётся на сервере
                  </Badge>
                )}
                {m.roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => remove(m, r)}
                    className="pressable rounded-chip bg-fill px-2.5 py-1 text-caption1 font-semibold"
                  >
                    {state.data.roles[r]} ×
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const REMOVE_REASONS = [
  'Билет не соответствует событию',
  'Файл не похож на билет',
  'Неверная зона или места',
  'Жалоба покупателя',
];
const BLOCK_REASONS = ['Продаёт чужие или поддельные билеты', 'Повторные нарушения правил'];

// Шторка «Причина» — для снятия объявления и блокировки продавца
function ReasonSheet({ action, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    setReason('');
    setError(null);
  }, [action]);

  const block = action?.type === 'block';
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (block) await adminBlockUser(action.listing.seller.id, reason.trim());
      else await adminRemoveListing(action.listing.id, reason.trim());
      haptic('success');
      onDone();
    } catch (e) {
      haptic('error');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={Boolean(action)}
      onClose={onClose}
      header={
        <div>
          <h2 className="text-title3">{block ? 'Заблокировать продавца' : 'Снять объявление'}</h2>
          {action && (
            <p className="text-footnote text-label-secondary">
              {block
                ? `${action.listing.seller.name}: все его объявления снимутся, продавать он не сможет`
                : `${action.listing.title} • ${formatPrice(action.listing.price)}`}
            </p>
          )}
        </div>
      }
      footer={
        <div>
          {error && <p className="mb-2 text-center text-footnote text-danger">{error}</p>}
          <Button size="lg" block loading={busy} disabled={reason.trim().length < 3} onClick={submit}>
            {block ? 'Заблокировать' : 'Снять с продажи'}
          </Button>
        </div>
      }
    >
      <p className="mb-2 text-footnote text-label-secondary">Причину увидит продавец</p>
      <div className="flex flex-wrap gap-2">
        {(block ? BLOCK_REASONS : REMOVE_REASONS).map((r) => (
          <Chip key={r} size="sm" variant="brand" active={reason === r} onClick={() => setReason(r)}>
            {r}
          </Chip>
        ))}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 300))}
        placeholder="Или опишите своими словами"
        rows={3}
        className="mt-3 w-full rounded-xl bg-fill px-3 py-2 text-body outline-none"
      />
    </BottomSheet>
  );
}

function ModerationCard({ listing, event, onRemove, onBlock, onUnblock }) {
  const { seller } = listing;
  const active = listing.status === 'active';
  return (
    <article className="card p-4">
      <p className="truncate text-footnote text-label-secondary">
        {event ? `${event.title} • ${formatEventDate(event.date)}` : `Событие ${listing.eventId}`}
      </p>
      <p className="mt-0.5 text-headline">{listing.title}</p>
      <p className="text-subhead">
        <b>{formatPrice(listing.price)}</b>
        {listing.quantity > 1 && <span className="text-label-secondary"> × {listing.quantity}</span>}
        <span className="text-label-tertiary"> / номинал {formatPrice(listing.nominal)}</span>
      </p>
      <p className="text-footnote text-label-secondary">
        {listing.details} • {new Date(listing.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-fill/60 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-footnote">
          <b>{seller.name}</b>
          <span className="text-label-secondary">
            {' '}
            • ID {seller.id}
            {seller.phoneVerified ? ' • номер подтверждён' : ' • номер не подтверждён'}
          </span>
        </span>
        {seller.blocked && (
          <Badge size="sm" tone="danger">
            Заблокирован
          </Badge>
        )}
        {seller.username && (
          <button
            type="button"
            onClick={() => openTelegramLink(`https://t.me/${seller.username}`)}
            className="shrink-0 text-footnote font-semibold text-brand"
          >
            @{seller.username}
          </button>
        )}
      </div>

      {listing.removedReason && (
        <p className="mt-2 text-footnote text-danger">Причина: {listing.removedReason}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {active && (
          <button type="button" onClick={onRemove} className="pressable h-9 rounded-xl bg-fill text-footnote font-semibold text-danger">
            Снять
          </button>
        )}
        {listing.own ? null : seller.blocked ? (
          <button type="button" onClick={onUnblock} className="pressable h-9 rounded-xl bg-fill text-footnote font-semibold">
            Разблокировать
          </button>
        ) : (
          <button type="button" onClick={onBlock} className="pressable h-9 rounded-xl bg-danger-soft text-footnote font-semibold text-danger">
            Заблокировать
          </button>
        )}
      </div>
    </article>
  );
}

function ListingsTab() {
  const [status, setStatus] = useState('active');
  const [state, reload] = useLoad(() => Promise.all([adminListings(status), adminEvents()]), [status]);
  const [action, setAction] = useState(null);

  // После модерации — обновить и очередь, и витрину этого устройства
  const done = () => {
    setAction(null);
    reload();
    refreshListings();
  };
  const unblock = async (listing) => {
    if (!(await confirmDialog(`Разблокировать ${listing.seller.name}? Снятые объявления не вернутся.`))) return;
    try {
      await adminUnblockUser(listing.seller.id);
      haptic('success');
      reload();
    } catch (e) {
      haptic('error');
      await confirmDialog(e.message);
    }
  };

  const [listings, events] = state.status === 'ok' ? [state.data[0].listings, state.data[1].events] : [[], []];

  return (
    <div className="space-y-3">
      <SegmentedControl
        value={status}
        onChange={setStatus}
        options={[
          { value: 'active', label: 'В продаже' },
          { value: 'removed', label: 'Снятые модератором' },
        ]}
      />
      {state.status === 'loading' && <PageLoader />}
      {state.status === 'error' && <p className="text-center text-subhead text-danger">{state.error.message}</p>}
      {state.status === 'ok' && listings.length === 0 && (
        <p className="px-4 py-6 text-center text-subhead text-label-secondary">Пусто</p>
      )}
      {listings.map((l) => (
        <ModerationCard
          key={l.id}
          listing={l}
          event={events.find((e) => e.id === l.eventId)}
          onRemove={() => setAction({ type: 'remove', listing: l })}
          onBlock={() => setAction({ type: 'block', listing: l })}
          onUnblock={() => unblock(l)}
        />
      ))}
      <ReasonSheet action={action} onClose={() => setAction(null)} onDone={done} />
    </div>
  );
}

const TABS = [
  { value: 'events', label: 'События', can: (p) => p.includes('events'), Tab: EventsTab },
  { value: 'listings', label: 'Модерация', can: (p) => p.includes('moderation'), Tab: ListingsTab },
  { value: 'deals', label: 'Сделки', can: (p) => p.includes('moderation'), Tab: DealsTab },
  { value: 'support', label: 'Обращения', can: (p) => p.includes('support') || p.includes('moderation'), Tab: SupportTab },
  { value: 'team', label: 'Команда', can: (p) => p.includes('team'), Tab: TeamTab },
];

export default function AdminPage() {
  const account = useServerAccount();
  // Вкладки — по правам из /api/me (сервер всё равно проверяет каждый запрос)
  const permissions = account.status === 'ok' ? (account.user.staff?.permissions ?? []) : [];
  const tabs = TABS.filter((t) => t.can(permissions));
  // Вкладка — в адресе: «Назад» из формы события или обращения возвращает на неё же
  const [params, setParams] = useSearchParams();
  const tab = tabs.find((t) => t.value === params.get('tab')) ?? tabs[0];

  // Правки событий видны на витрине этого устройства сразу после возврата из админки
  useEffect(() => () => void refreshEvents(), []);

  return (
    <>
      <TopBar title="Админка" left={<BackLink label="Профиль" />} />
      <main className="space-y-3 px-gutter pb-6 pt-3">
        <AdminGate account={account}>
          {/* Вкладок до пяти — лента прокручивается, а не сжимается в нечитаемое */}
          {tabs.length > 1 && (
            <div className="chips-scroll -mx-gutter px-gutter">
              {tabs.map((t) => (
                <Chip key={t.value} active={tab.value === t.value} onClick={() => setParams({ tab: t.value }, { replace: true })}>
                  {t.label}
                </Chip>
              ))}
            </div>
          )}
          {tab && <tab.Tab />}
        </AdminGate>
      </main>
    </>
  );
}
