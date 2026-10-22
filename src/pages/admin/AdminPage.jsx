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
import {
  adminBlockUser,
  adminEvents,
  adminListings,
  adminRemoveListing,
  adminUnblockUser,
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

function EventsTab() {
  const navigate = useNavigate();
  const [state] = useLoad(adminEvents, []);

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
                onClick={() => navigate(`/admin/events/${e.id}`)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-fill/60 ${past ? 'opacity-60' : ''}`}
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

export default function AdminPage() {
  const account = useServerAccount();
  // Вкладка — в адресе: «Назад» из формы события возвращает на неё же
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'listings' ? 'listings' : 'events';

  // Правки событий видны на витрине этого устройства сразу после возврата из админки
  useEffect(() => () => void refreshEvents(), []);

  return (
    <>
      <TopBar title="Админка" left={<BackLink label="Профиль" />} />
      <main className="space-y-3 px-gutter pb-6 pt-3">
        <AdminGate account={account}>
          <SegmentedControl
            value={tab}
            onChange={(t) => setParams({ tab: t }, { replace: true })}
            options={[
              { value: 'events', label: 'События' },
              { value: 'listings', label: 'Модерация' },
            ]}
          />
          {tab === 'events' ? <EventsTab /> : <ListingsTab />}
        </AdminGate>
      </main>
    </>
  );
}
