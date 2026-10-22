import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import { Composer, Messages, THREAD_STATUS } from '@/components/support/Conversation';
import Badge from '@/components/ui/Badge';
import PageLoader from '@/components/ui/PageLoader';
import { useServerAccount } from '@/hooks/useServerAccount';
import { adminSupportClose, adminSupportReply, adminSupportThread } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { confirmDialog, haptic, openTelegramLink } from '@/lib/telegram';
import { AdminGate } from './AdminPage';

// Обращение глазами команды: кто пишет, на какое объявление жалоба, переписка и ответ
export default function AdminThreadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const account = useServerAccount();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (account.status !== 'ok' || !account.user.isAdmin) return;
    adminSupportThread(id)
      .then((data) => setState({ status: 'ok', ...data }))
      .catch((error) => setState({ status: 'error', error }));
  }, [id, account]);

  const reply = async (body) => {
    const data = await adminSupportReply(id, body);
    haptic('success');
    setState({ status: 'ok', ...data });
  };

  const close = async () => {
    if (!(await confirmDialog('Закрыть обращение? Если пользователь напишет снова, оно откроется.'))) return;
    const data = await adminSupportClose(id);
    setState({ status: 'ok', ...data });
  };

  const { thread, listing } = state;

  return (
    <>
      <TopBar
        title={thread?.categoryLabel ?? 'Обращение'}
        left={<BackLink label="Обращения" />}
        right={
          thread && thread.status !== 'closed' ? (
            <button type="button" onClick={close} className="text-body text-brand">
              Закрыть
            </button>
          ) : null
        }
      />
      <AdminGate account={account}>
        {state.status === 'loading' ? (
          <PageLoader />
        ) : state.status === 'error' ? (
          <p className="px-gutter py-10 text-center text-subhead text-danger">{state.error.message}</p>
        ) : (
          <>
            <main className="space-y-3 px-gutter pb-[calc(96px+var(--app-safe-bottom))] pt-3">
              <section className="card flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate text-footnote">
                  <b>{thread.user.name}</b>
                  <span className="text-label-secondary"> • ID {thread.user.id}</span>
                </span>
                <Badge size="sm" tone={THREAD_STATUS[thread.status].tone}>
                  {THREAD_STATUS[thread.status].label}
                </Badge>
                {thread.user.username && (
                  <button
                    type="button"
                    onClick={() => openTelegramLink(`https://t.me/${thread.user.username}`)}
                    className="shrink-0 text-footnote font-semibold text-brand"
                  >
                    @{thread.user.username}
                  </button>
                )}
              </section>

              {listing && (
                <button
                  type="button"
                  onClick={() => navigate('/admin?tab=listings')}
                  className="card w-full p-3 text-left"
                >
                  <p className="text-footnote text-label-secondary">Жалоба на объявление • {listing.eventTitle}</p>
                  <p className="text-headline">{listing.title}</p>
                  <p className="text-footnote text-label-secondary">
                    {formatPrice(listing.price)} / номинал {formatPrice(listing.nominal)} • продавец {listing.seller.name}, ID{' '}
                    {listing.sellerId} • {listing.status === 'active' ? 'в продаже' : 'снято'}
                  </p>
                  <p className="mt-1 text-footnote font-semibold text-brand">Открыть модерацию →</p>
                </button>
              )}

              <Messages messages={state.messages} mine="staff" userName={thread.user.name} />
              <p className="text-center text-caption1 text-label-tertiary">
                Пользователь увидит ответ от «Поддержка Tickety» и получит сообщение от бота
              </p>
            </main>
            <Composer onSend={reply} placeholder="Ответ пользователю" />
          </>
        )}
      </AdminGate>
    </>
  );
}
