import { useEffect, useState } from 'react';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import PageLoader from '@/components/ui/PageLoader';
import { apiEnabled, fetchWallet, requestPayout } from '@/lib/api';
import { formatEventDate, formatPrice } from '@/lib/format';
import { confirmDialog, haptic } from '@/lib/telegram';

const SALE_STATUS = {
  paid: { label: 'Удерживается', tone: 'brand' },
  disputed: { label: 'Спор', tone: 'danger' },
  completed: { label: 'Зачислено', tone: 'success' },
  refunded: { label: 'Возврат покупателю', tone: 'neutral' },
};

const Balance = ({ label, value, hint, accent }) => (
  <div className="card p-4">
    <p className="text-footnote text-label-secondary">{label}</p>
    <p className={`mt-0.5 text-title2 ${accent ? 'text-success' : ''}`}>{formatPrice(value)}</p>
    {hint && <p className="mt-1 text-caption1 text-label-tertiary">{hint}</p>}
  </div>
);

// Кошелёк продавца: удерживаемые деньги по продажам, доступные к выводу, выводы
export default function WalletPage() {
  const [state, setState] = useState({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiEnabled) return;
    fetchWallet()
      .then(({ wallet }) => setState({ status: 'ok', wallet }))
      .catch((e) => setState({ status: 'error', error: e }));
  }, []);

  const payout = async () => {
    const { available } = state.wallet;
    if (!(await confirmDialog(`Вывести ${formatPrice(available)}? В бете это тестовая операция — деньги никуда не переводятся.`))) return;
    setBusy(true);
    setError(null);
    try {
      const { wallet } = await requestPayout(available);
      haptic('success');
      setState({ status: 'ok', wallet });
    } catch (e) {
      haptic('error');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const w = state.wallet;

  return (
    <>
      <TopBar title="Кошелёк" left={<BackLink label="Профиль" />} />
      {!apiEnabled ? (
        <p className="px-gutter py-10 text-center text-subhead text-label-secondary">Кошелёк работает только с сервером</p>
      ) : state.status === 'loading' ? (
        <PageLoader />
      ) : state.status === 'error' ? (
        <p className="px-gutter py-10 text-center text-subhead text-danger">{state.error.message}</p>
      ) : (
        <main className="space-y-3 px-gutter pb-8 pt-3">
          {w.mode === 'test' && (
            <p className="rounded-2xl bg-[#FFF4E5] px-4 py-3 text-subhead text-[#8A4B00] dark:bg-[#3A2A12] dark:text-[#FFC266]">
              <b>Бета: тестовые деньги.</b> Суммы настоящие по расчётам, но оплата и вывод — тестовые.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Balance label="Удерживается" value={w.held} hint="До суток после события" />
            <Balance label="Доступно" value={w.available} hint={`Выведено: ${formatPrice(w.paidOut)}`} accent />
          </div>
          {error && <p className="text-center text-footnote text-danger">{error}</p>}
          <Button size="lg" block disabled={w.available <= 0} loading={busy} onClick={payout}>
            {w.available > 0 ? `Вывести ${formatPrice(w.available)}${w.mode === 'test' ? ' (тест)' : ''}` : 'Нечего выводить'}
          </Button>

          <h2 className="px-4 pt-3 text-footnote font-medium uppercase tracking-wide text-label-secondary">Продажи</h2>
          {w.sales.length === 0 ? (
            <p className="px-4 text-subhead text-label-secondary">Пока ничего не продано</p>
          ) : (
            <div className="card divide-y divide-separator overflow-hidden">
              {w.sales.map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-headline">{s.event.title}</p>
                    <Badge size="sm" tone={SALE_STATUS[s.status].tone} className="shrink-0">
                      {SALE_STATUS[s.status].label}
                    </Badge>
                  </div>
                  <p className="truncate text-footnote text-label-secondary">
                    {s.title} • покупатель {s.buyer.name}
                  </p>
                  <p className="text-subhead">
                    <b>{formatPrice(s.sellerAmount)}</b>
                    {s.status === 'paid' && (
                      <span className="text-label-secondary"> • придут после {formatEventDate(s.holdUntil)}</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          {w.payouts.length > 0 && (
            <>
              <h2 className="px-4 pt-3 text-footnote font-medium uppercase tracking-wide text-label-secondary">Выводы</h2>
              <div className="card divide-y divide-separator overflow-hidden">
                {w.payouts.map((p) => (
                  <div key={p.id} className="flex justify-between px-4 py-3 text-subhead">
                    <span>{new Date(p.createdAt).toLocaleDateString('ru-RU')}{p.provider === 'test' ? ' • тест' : ''}</span>
                    <b>−{formatPrice(p.amount)}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      )}
    </>
  );
}
