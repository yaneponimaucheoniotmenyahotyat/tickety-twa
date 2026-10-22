import Icon from '@/components/icons/Icon';
import Badge from '@/components/ui/Badge';
import { DEMO_MODE } from '@/data/mockData';

export default function FairPriceCard() {
  return (
    <section className="card flex gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name="shield-check" className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-subhead font-semibold">Честная цена: без спекуляций</h3>
          <Badge tone="success" size="sm">Max 0%</Badge>
        </div>
        <p className="mt-1 text-footnote text-label-secondary">
          Tickety не даёт выставить билет дороже номинала.
          {DEMO_MODE && ' Деньги замораживаются до вашего успешного прохода через турникет.'}
        </p>
      </div>
    </section>
  );
}
