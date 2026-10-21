import Icon from '@/components/icons/Icon';
import QrCode from './QrCode';
import { QR_ROTATE_S, TRANSFER_MS, qrPayload } from '@/lib/tickets';

// Блок прохода: QR с ротацией раз в 30 с / ожидание переоформления / использованный билет
export default function TicketQr({ ticket, status, now }) {
  if (status === 'transfer') {
    const progress = Math.min(1, (now - ticket.purchasedAt) / TRANSFER_MS);
    return (
      <div className="flex flex-col items-center px-6 py-8 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
          <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-current border-t-transparent" />
        </span>
        <p className="mt-4 text-headline">Продавец переоформляет билет</p>
        <p className="mt-1 text-subhead text-label-secondary">
          QR-код появится здесь автоматически. Деньги заморожены и не уйдут продавцу до вашего прохода.
        </p>
        <div className="mt-4 h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-fill">
          <div className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    );
  }

  const sec = Math.floor(now / 1000);
  const windowIndex = Math.floor(sec / QR_ROTATE_S);
  const secondsLeft = QR_ROTATE_S - (sec % QR_ROTATE_S);
  const used = status === 'used';

  return (
    <div className="flex flex-col items-center px-6 py-6 text-center">
      <div className={`relative rounded-2xl bg-white p-2 shadow-card ${used ? 'opacity-30' : ''}`}>
        <QrCode value={qrPayload(ticket, used ? 0 : windowIndex)} className="h-56 w-56" />
      </div>
      {used ? (
        <p className="mt-4 flex items-center gap-1.5 text-subhead text-label-secondary">
          <Icon name="check" className="h-5 w-5" /> Билет использован
        </p>
      ) : (
        <>
          <p className="mt-4 text-headline">Покажите код на входе</p>
          <p className="mt-1 text-footnote text-label-secondary">
            Код обновляется каждые {QR_ROTATE_S} с — скриншот не сработает
          </p>
          <div className="mt-3 flex w-full max-w-60 items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full bg-success transition-[width] duration-1000 ease-linear"
                style={{ width: `${(secondsLeft / QR_ROTATE_S) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-caption1 tabular-nums text-label-tertiary">{secondsLeft} с</span>
          </div>
        </>
      )}
      <p className="mt-4 font-mono text-subhead tracking-widest text-label-secondary">{ticket.code}</p>
    </div>
  );
}
