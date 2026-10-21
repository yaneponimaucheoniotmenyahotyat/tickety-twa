import Icon from '@/components/icons/Icon';

const VARIANTS = {
  primary: 'bg-brand text-white shadow-cta',  // «Оплатить», «Купить через СБП», «Применить»
  soft: 'bg-brand-soft text-brand-ink',        // «Выбрать места»
  plain: 'bg-fill text-label',
};

const SIZES = {
  sm: { box: 'h-8 gap-1 rounded-xl px-3 text-footnote', icon: 'h-4 w-4' },
  md: { box: 'h-11 gap-1.5 rounded-xl px-4 text-subhead', icon: 'h-5 w-5' },
  lg: { box: 'h-14 gap-2 rounded-2xl px-6 text-headline', icon: 'h-6 w-6' },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  block = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  const s = SIZES[size];
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`pressable inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold disabled:opacity-50 disabled:shadow-none ${VARIANTS[variant]} ${s.box} ${block ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <span className={`${s.icon} animate-spin rounded-full border-2 border-current border-t-transparent`} />
      ) : (
        icon && <Icon name={icon} className={s.icon} />
      )}
      {children}
      {iconRight && !loading && <Icon name={iconRight} className={s.icon} />}
    </button>
  );
}
