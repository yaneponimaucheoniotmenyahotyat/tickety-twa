import { haptic } from '@/lib/telegram';

// ink — чёрный активный чип (категории на витрине), brand — синий (фильтры в шторке)
const ACTIVE = {
  ink: 'bg-label text-surface',
  brand: 'bg-brand text-white',
};

export default function Chip({ active, onClick, variant = 'ink', size = 'md', children }) {
  const box = size === 'sm' ? 'h-7 px-3 text-footnote rounded-lg' : 'h-9 px-4 text-subhead rounded-chip';
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        haptic('selection');
        onClick?.();
      }}
      className={`pressable shrink-0 whitespace-nowrap font-medium transition-colors ${box} ${
        active ? ACTIVE[variant] : 'bg-fill text-label'
      }`}
    >
      {children}
    </button>
  );
}
