import { haptic } from '@/lib/telegram';

// iOS UISegmentedControl; при большом числе сегментов скроллится по горизонтали
// dense — меньше отступы, чтобы 4 вкладки влезли в ширину телефона
export default function SegmentedControl({ options, value, onChange, dense = false }) {
  return (
    <div role="tablist" className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-[10px] bg-fill p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              haptic('selection');
              onChange(o.value);
            }}
            className={`flex-1 whitespace-nowrap rounded-lg ${dense ? 'px-1.5' : 'px-3'} py-1.5 text-footnote font-semibold transition-all duration-200 ${
              active ? 'bg-surface text-label shadow-[0_3px_8px_rgb(0_0_0/0.12)]' : 'text-label-secondary'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
