import Icon from '@/components/icons/Icon';

// Плашка «Безопасная сделка» — витрина и страница события
export default function SafeDealNotice({ className = '' }) {
  return (
    <aside className={`flex items-start gap-3 rounded-2.5xl bg-fill/70 p-4 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success-mint text-[#002107]">
        <Icon name="lock" className="h-6 w-6" />
      </span>
      <div>
        <p className="text-subhead font-semibold">Безопасная сделка</p>
        <p className="mt-0.5 text-footnote text-label-secondary">
          Средства резервируются на эскроу-счёте и переводятся продавцу только после вашего успешного
          прохода на событие.
        </p>
      </div>
    </aside>
  );
}
