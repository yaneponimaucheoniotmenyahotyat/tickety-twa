import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import TopBar from '@/components/layout/TopBar';
import EventCover from '@/components/event/EventCover';
import Badge from '@/components/ui/Badge';
import BottomSheet from '@/components/ui/BottomSheet';
import ListRow from '@/components/ui/ListRow';
import Toggle from '@/components/ui/Toggle';
import Button from '@/components/ui/Button';
import { confirmPhone } from '@/data/accountStore';
import { clearListings } from '@/data/listingsStore';
import { useEvents } from '@/hooks/useEvents';
import { clearFavorites, useFavorites } from '@/hooks/useFavorites';
import { useServerAccount } from '@/hooks/useServerAccount';
import { clearTickets, useTickets } from '@/hooks/useTickets';
import { formatEventDate, formatPrice, initials } from '@/lib/format';
import { ticketSavings } from '@/lib/tickets';
import {
  confirmDialog,
  getUser,
  haptic,
  isTelegram,
  requestWriteAccess,
  writeAccessPreGranted,
} from '@/lib/telegram';

const NOTIFY_KEY = 'tickety:notify';

function readNotifyPref() {
  try {
    return localStorage.getItem(NOTIFY_KEY) === '1';
  } catch {
    return false;
  }
}

function saveNotifyPref(on) {
  try {
    localStorage.setItem(NOTIFY_KEY, on ? '1' : '0');
  } catch {
    /* не критично: переключатель просто не запомнится */
  }
}

const Section = ({ title, children }) => (
  <section>
    {title && (
      <h2 className="mb-2 mt-6 px-4 text-footnote font-medium uppercase tracking-wide text-label-secondary">{title}</h2>
    )}
    <div className="card divide-y divide-separator overflow-hidden">{children}</div>
  </section>
);

const Stat = ({ value, label }) => (
  <div className="card px-2 py-3 text-center">
    <p className="truncate text-title3 font-bold">{value}</p>
    <p className="text-caption1 text-label-secondary">{label}</p>
  </div>
);

const SAFE_DEAL_STEPS = [
  ['Оплата', 'Деньги замораживаются на эскроу-счёте — продавец их пока не получает.'],
  ['Переоформление', 'Продавец передаёт билет покупателю.'],
  ['Проход', 'Вы показываете QR-код на входе, контролёр его сканирует.'],
  ['Выплата', 'Только после вашего прохода деньги уходят продавцу. Не прошли — вернём всю сумму.'],
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getUser();
  const tickets = useTickets();
  const favorites = useFavorites();
  const [notify, setNotify] = useState(() => writeAccessPreGranted() || readNotifyPref());
  const [safeDealOpen, setSafeDealOpen] = useState(false);
  const account = useServerAccount();
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState(null);
  const onConfirmPhone = async () => {
    setPhoneBusy(true);
    setPhoneError(await confirmPhone());
    setPhoneBusy(false);
  };

  const savings = useMemo(() => tickets.reduce((sum, t) => sum + ticketSavings(t), 0), [tickets]);
  const events = useEvents();
  const favoriteEvents = events.filter((e) => favorites.has(e.id));
  const name = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : 'Гость';

  const toggleNotify = async (on) => {
    if (!on) {
      setNotify(false);
      saveNotifyPref(false);
      return;
    }
    // Telegram сам покажет системный запрос «Разрешить боту писать вам?»
    const granted = await requestWriteAccess();
    haptic(granted ? 'success' : 'error');
    setNotify(granted);
    saveNotifyPref(granted);
  };

  const resetData = async () => {
    const ok = await confirmDialog('Удалить купленные билеты, объявления и избранное с этого устройства?');
    if (!ok) return;
    clearTickets();
    clearFavorites();
    clearListings();
    haptic('success');
  };

  return (
    <>
      <TopBar title="Профиль" />
      <main className="px-gutter pb-6 pt-4">
        <header className="flex flex-col items-center text-center">
          <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand to-[#4D94FF] text-title2 text-white">
            {user?.photo_url ? (
              <img src={user.photo_url} alt="" className="h-full w-full object-cover" />
            ) : user ? (
              initials(name)
            ) : (
              <Icon name="person" className="h-12 w-12" />
            )}
          </span>
          <h1 className="mt-3 text-title2">{name}</h1>
          <p className="text-subhead text-label-secondary">
            {user?.username ? `@${user.username}` : user ? `ID ${user.id}` : 'Откройте Tickety в Telegram, чтобы войти'}
          </p>
          {user?.is_premium && (
            <Badge tone="brand" icon="verified" className="mt-2">
              Telegram Premium
            </Badge>
          )}
        </header>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat value={tickets.length} label="Билетов" />
          <Stat value={formatPrice(savings)} label="Сэкономлено" />
          <Stat value={favorites.size} label="В избранном" />
        </div>

        <button
          type="button"
          onClick={() => navigate('/sell')}
          className="card pressable mt-3 flex w-full items-center gap-3 p-4 text-left"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success-mint text-[#002107]">
            <Icon name="tab-sell" className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-headline">Продать лишний билет</span>
            <span className="block text-footnote text-label-secondary">
              Цена не выше номинала, только продавцы с подтверждённым номером
            </span>
          </span>
          <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-label-tertiary" />
        </button>

        <Section title="Избранное">
          {favoriteEvents.length ? (
            favoriteEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => navigate(`/event/${e.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-fill/60"
              >
                <EventCover event={e} className="h-9 w-9 shrink-0 rounded-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body">{e.title}</span>
                  <span className="block truncate text-footnote text-label-secondary">
                    {formatEventDate(e.date)} • {e.venue}
                  </span>
                </span>
                <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-label-tertiary" />
              </button>
            ))
          ) : (
            <ListRow
              icon="heart"
              iconClass="bg-[#FDE7E5] text-[#FF3B30]"
              title="Пока пусто"
              subtitle="Отмечайте ♥ события на витрине"
              onClick={() => navigate('/')}
            />
          )}
        </Section>

        <Section title="Настройки">
          <ListRow
            icon="bolt"
            title="Уведомления в Telegram"
            subtitle={
              isTelegram ? 'Бот напишет, когда билет переоформят' : 'Доступно только внутри Telegram'
            }
            accessory={<Toggle checked={notify} onChange={toggleNotify} label="Уведомления в Telegram" />}
          />
          <ListRow
            icon="tune"
            iconClass="bg-fill text-label-secondary"
            title="Оформление"
            subtitle="Как в Telegram — светлое или тёмное"
          />
        </Section>

        <Section title="Tickety">
          {account.status !== 'off' && (
            <ListRow
              icon={account.status === 'error' ? 'lock' : 'shield-check'}
              iconClass={
                account.status === 'ok'
                  ? 'bg-success-soft text-success'
                  : account.status === 'error'
                    ? 'bg-danger-soft text-danger'
                    : 'bg-fill text-label-secondary'
              }
              title="Аккаунт Tickety"
              subtitle={
                account.status === 'ok'
                  ? `Вход через Telegram подтверждён • с ${new Date(account.user.createdAt).toLocaleDateString('ru-RU')}`
                  : account.status === 'error'
                    ? account.error.message
                    : 'Подключаемся к серверу…'
              }
            />
          )}
          {account.status === 'ok' && (
            <ListRow
              icon="person"
              iconClass={account.user.phoneVerified ? 'bg-success-soft text-success' : 'bg-fill text-label-secondary'}
              title="Номер телефона"
              subtitle={
                phoneError ??
                (account.user.phoneVerified
                  ? `Подтверждён • ${account.user.phoneMasked}`
                  : 'Нужен, чтобы продавать билеты')
              }
              accessory={
                !account.user.phoneVerified && (
                  <Button size="sm" variant="soft" loading={phoneBusy} onClick={onConfirmPhone}>
                    Подтвердить
                  </Button>
                )
              }
            />
          )}
          {account.status === 'ok' && (
            <ListRow
              icon="card"
              iconClass="bg-success-soft text-success"
              title="Кошелёк"
              subtitle="Деньги за проданные билеты"
              onClick={() => navigate('/wallet')}
            />
          )}
          {account.status === 'ok' && (
            <ListRow
              icon="shield-heart"
              iconClass="bg-brand-soft text-brand"
              title="Поддержка"
              subtitle="Вопрос, проблема с покупкой или продажей"
              onClick={() => navigate('/support')}
            />
          )}
          {account.status === 'ok' && account.user.isAdmin && (
            <ListRow
              icon="tune"
              iconClass="bg-brand text-white"
              title="Админка"
              subtitle={account.user.staff?.owner ? 'Владелец • события, модерация, поддержка, команда' : 'Для команды Tickety'}
              onClick={() => navigate('/admin')}
            />
          )}
          <ListRow
            icon="shield-heart"
            iconClass="bg-success-soft text-success"
            title="Как работает безопасная сделка"
            onClick={() => setSafeDealOpen(true)}
          />
          <ListRow
            icon="lock"
            iconClass="bg-fill text-label-secondary"
            title="Публичная оферта"
            subtitle={
              account.status === 'ok' && account.user.offer?.acceptedAt
                ? `Принята ${new Date(account.user.offer.acceptedAt).toLocaleDateString('ru-RU')}`
                : 'Условия использования Tickety'
            }
            onClick={() => navigate('/legal/offer')}
          />
          <ListRow
            icon="verified"
            iconClass="bg-fill text-label-secondary"
            title="О приложении"
            subtitle={`Версия ${__APP_VERSION__} • сборка ${__APP_COMMIT__}`}
          />
        </Section>

        <Section>
          <ListRow title="Сбросить данные на этом устройстве" danger onClick={resetData} />
        </Section>
      </main>

      <BottomSheet
        open={safeDealOpen}
        onClose={() => setSafeDealOpen(false)}
        header={<h2 className="text-title3">Безопасная сделка</h2>}
      >
        <ol className="space-y-4 pb-2">
          {SAFE_DEAL_STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-footnote font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-headline">{title}</p>
                <p className="text-subhead text-label-secondary">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </BottomSheet>
    </>
  );
}
