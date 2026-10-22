import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import { Composer, Messages, THREAD_STATUS } from '@/components/support/Conversation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import PageLoader from '@/components/ui/PageLoader';
import { getOffer } from '@/data/mockData';
import { useListingOffers } from '@/hooks/useListings';
import { apiEnabled, createSupportThread, sendSupportMessage, supportThread, supportThreads } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { haptic } from '@/lib/telegram';

// Темы обращений — те же, что на сервере (support.js)
const CATEGORIES = [
  { id: 'question', label: 'Вопрос' },
  { id: 'buying', label: 'Покупка билета' },
  { id: 'selling', label: 'Продажа билета' },
];

function Unavailable() {
  return (
    <p className="px-gutter py-10 text-center text-subhead text-label-secondary">
      Поддержка работает только в Telegram-версии с сервером
    </p>
  );
}

// Список моих обращений
export function SupportListPage() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!apiEnabled) return;
    supportThreads()
      .then(({ threads }) => setState({ status: 'ok', threads }))
      .catch((error) => setState({ status: 'error', error }));
  }, []);

  return (
    <>
      <TopBar title="Поддержка" left={<BackLink label="Профиль" />} />
      {!apiEnabled ? (
        <Unavailable />
      ) : (
        <main className="space-y-3 px-gutter pb-6 pt-3">
          <section className="card p-5">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon name="shield-heart" className="h-7 w-7" />
            </span>
            <h1 className="mt-3 text-title3">Напишите нам</h1>
            <p className="mt-1 text-subhead text-label-secondary">
              Отвечает команда Tickety. Ответ придёт сюда и сообщением от бота.
            </p>
            <Button size="lg" block className="mt-4" onClick={() => navigate('/support/new')}>
              Новое обращение
            </Button>
          </section>

          {state.status === 'loading' && <PageLoader />}
          {state.status === 'error' && <p className="text-center text-subhead text-danger">{state.error.message}</p>}
          {state.status === 'ok' && state.threads.length > 0 && (
            <div className="card divide-y divide-separator overflow-hidden">
              {state.threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/support/${t.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-fill/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-headline">{t.categoryLabel}</span>
                    <span className="block truncate text-footnote text-label-secondary">
                      {t.lastMessage ? `${t.lastMessage.author === 'user' ? 'Вы: ' : ''}${t.lastMessage.body}` : ''}
                    </span>
                  </span>
                  <Badge size="sm" tone={THREAD_STATUS[t.status].tone}>
                    {THREAD_STATUS[t.status].label}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </main>
      )}
    </>
  );
}

// Новое обращение. ?listing=<id> — жалоба на объявление
export function SupportNewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const listingId = params.get('listing');
  useListingOffers(); // объявление может прийти с сервера чуть позже
  const listing = listingId ? getOffer(listingId) : null;
  const [category, setCategory] = useState(listingId ? 'complaint' : 'question');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { thread } = await createSupportThread({
        category,
        body: body.trim(),
        ...(category === 'complaint' ? { listingId } : {}),
      });
      haptic('success');
      navigate(`/support/${thread.id}`, { replace: true });
    } catch (e) {
      haptic('error');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title={listingId ? 'Жалоба' : 'Новое обращение'} left={<BackLink />} />
      {!apiEnabled ? (
        <Unavailable />
      ) : (
        <main className="space-y-3 px-gutter pb-[calc(100px+var(--app-safe-bottom))] pt-3">
          {listingId ? (
            <section className="card p-4">
              <p className="text-footnote text-label-secondary">Жалоба на объявление</p>
              <p className="text-headline">{listing?.title ?? 'Объявление'}</p>
              {listing && (
                <p className="text-subhead text-label-secondary">
                  {formatPrice(listing.price)} • {listing.seller.name}
                </p>
              )}
              <p className="mt-2 text-footnote text-label-secondary">
                Модератор проверит объявление. Продавец не узнает, кто пожаловался.
              </p>
            </section>
          ) : (
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip key={c.id} size="sm" variant="brand" active={category === c.id} onClick={() => setCategory(c.id)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            rows={7}
            placeholder={
              listingId
                ? 'Что не так? Например: просит оплату на карту, билет на другое событие, цена не совпадает'
                : 'Опишите вопрос — чем подробнее, тем быстрее поможем'
            }
            className="w-full rounded-2xl bg-surface p-4 text-body outline-none placeholder:text-label-tertiary"
          />
          <p className="px-1 text-caption1 text-label-tertiary">
            Не пишите сюда пароли, коды из СМС и данные карт — команда Tickety их никогда не спрашивает.
          </p>
        </main>
      )}
      {apiEnabled && (
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-separator/60 bg-bg/90 px-gutter pb-[calc(12px+var(--app-safe-bottom))] pt-3 backdrop-blur-xl">
          {error && <p className="mb-2 text-center text-footnote text-danger">{error}</p>}
          <Button size="lg" block loading={busy} disabled={body.trim().length < 5} onClick={submit}>
            Отправить
          </Button>
        </footer>
      )}
    </>
  );
}

// Переписка в обращении
export function SupportThreadPage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!apiEnabled) return;
    supportThread(id)
      .then((data) => setState({ status: 'ok', ...data }))
      .catch((error) => setState({ status: 'error', error }));
  }, [id]);

  const send = async (body) => {
    const data = await sendSupportMessage(id, body);
    haptic('light');
    setState({ status: 'ok', ...data });
  };

  return (
    <>
      <TopBar title={state.thread?.categoryLabel ?? 'Обращение'} left={<BackLink label="Поддержка" />} />
      {!apiEnabled ? (
        <Unavailable />
      ) : state.status === 'loading' ? (
        <PageLoader />
      ) : state.status === 'error' ? (
        <p className="px-gutter py-10 text-center text-subhead text-danger">{state.error.message}</p>
      ) : (
        <>
          <main className="space-y-3 px-gutter pb-[calc(96px+var(--app-safe-bottom))] pt-3">
            <Messages messages={state.messages} mine="user" />
            {state.thread.status === 'open' && (
              <p className="text-center text-caption1 text-label-tertiary">
                Команда ответит здесь — и бот пришлёт уведомление
              </p>
            )}
            {state.thread.status === 'closed' && (
              <p className="text-center text-caption1 text-label-tertiary">
                Обращение закрыто. Напишите — и оно откроется снова
              </p>
            )}
          </main>
          <Composer onSend={send} />
        </>
      )}
    </>
  );
}
