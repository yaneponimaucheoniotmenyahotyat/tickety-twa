import Icon from '@/components/icons/Icon';
import { formatPrice } from '@/lib/format';

// Шаги «Безопасной сделки»: сколько пройдено — зависит от статуса билета
const DONE_BY_STATUS = { transfer: 1, ready: 2, used: 4 };

export default function EscrowTimeline({ ticket, status }) {
  const steps = [
    { title: `Оплачено ${formatPrice(ticket.total)}`, text: 'Деньги заморожены на эскроу-счёте Tickety' },
    { title: 'Билет переоформлен на вас', text: `Продавец ${ticket.seller} передал билет, штрихкод проверен` },
    { title: 'Проход на событие', text: 'Контролёр сканирует QR-код на входе' },
    { title: 'Выплата продавцу', text: 'Только после вашего успешного прохода' },
  ];
  const done = DONE_BY_STATUS[status];

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 text-headline">
        <Icon name="shield-heart" className="h-5 w-5 text-success" />
        Безопасная сделка
      </h2>
      <ol className="mt-4">
        {steps.map((s, i) => {
          const state = i < done ? 'done' : i === done ? 'current' : 'pending';
          return (
            <li key={s.title} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 && (
                <span
                  className={`absolute left-[11px] top-6 h-[calc(100%-24px)] w-0.5 ${i < done ? 'bg-success' : 'bg-fill'}`}
                />
              )}
              <span
                className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  state === 'done'
                    ? 'bg-success text-white'
                    : state === 'current'
                      ? 'bg-brand-soft ring-2 ring-brand'
                      : 'bg-fill'
                }`}
              >
                {state === 'done' && <Icon name="check" className="h-6 w-6" />}
                {state === 'current' && <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={`text-subhead font-semibold ${state === 'pending' ? 'text-label-tertiary' : ''}`}>{s.title}</p>
                <p className="text-footnote text-label-secondary">{s.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
