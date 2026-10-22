import Icon from '@/components/icons/Icon';
import { DEMO_MODE } from '@/data/mockData';

// Плашка «Безопасная сделка» — витрина и страница события.
// В бете оплата через Tickety ещё не подключена — так и пишем, а не обещаем эскроу.
export default function SafeDealNotice({ className = '' }) {
  return (
    <aside className={`flex items-start gap-3 rounded-2.5xl bg-fill/70 p-4 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success-mint text-[#002107]">
        <Icon name="lock" className="h-6 w-6" />
      </span>
      <div>
        <p className="text-subhead font-semibold">Безопасная сделка{DEMO_MODE ? '' : ' — скоро'}</p>
        <p className="mt-0.5 text-footnote text-label-secondary">
          {DEMO_MODE
            ? 'Средства резервируются на эскроу-счёте и переводятся продавцу только после вашего успешного прохода на событие.'
            : 'Сейчас идёт бета: оплата через Tickety пока не подключена. Скоро деньги будут удерживаться до вашего прохода на событие.'}
        </p>
      </div>
    </aside>
  );
}
