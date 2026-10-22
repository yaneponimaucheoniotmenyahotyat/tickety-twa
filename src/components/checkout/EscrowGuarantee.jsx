import Icon from '@/components/icons/Icon';

// «Гарантия безопасности „Сделка Tickety“» — ikonka_garantia_bezopasnosti
export default function EscrowGuarantee() {
  return (
    <aside className="flex gap-3 rounded-2.5xl bg-success-soft p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success-mint text-[#002107]">
        <Icon name="shield-heart" className="h-6 w-6" />
      </span>
      <div>
        <p className="text-headline">Гарантия безопасности «Сделка Tickety»</p>
        <p className="mt-1 text-footnote text-label-secondary">
          Деньги лежат на номинальном эскроу-счёте. Продавец получит выплату только после вашего
          успешного прохода на событие.
        </p>
      </div>
    </aside>
  );
}
