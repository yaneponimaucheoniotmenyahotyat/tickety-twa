import Icon from '@/components/icons/Icon';
import Badge from '@/components/ui/Badge';
import Radio from '@/components/ui/Radio';
import { haptic } from '@/lib/telegram';

export default function PaymentMethodItem({ method, selected, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => {
        haptic('selection');
        onSelect(method.id);
      }}
      className={`card flex w-full items-center gap-3 p-3 text-left ring-inset transition-shadow duration-200 ${
        selected ? 'ring-2 ring-brand' : ''
      }`}
    >
      {method.mono ? (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fill text-label">
          <Icon name={method.icon} className="h-6 w-6" />
        </span>
      ) : (
        <Icon name={method.icon} className="h-10 w-10 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-headline">{method.title}</span>
          {method.badge && (
            <Badge tone={method.badge.tone} size="sm">
              {method.badge.label}
            </Badge>
          )}
        </span>
        <span className="block truncate text-footnote text-label-secondary">{method.subtitle}</span>
      </span>
      <Radio checked={selected} />
    </button>
  );
}
