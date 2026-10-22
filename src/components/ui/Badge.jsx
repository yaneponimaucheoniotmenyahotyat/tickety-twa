import Icon from '@/components/icons/Icon';

const TONES = {
  danger: 'bg-danger text-white',                   // «Осталось 14 билетов»
  success: 'bg-success-soft text-success',          // «Продавец подтверждён», «0%»
  mint: 'bg-success-mint/30 text-success',          // «Продавец подтверждён» на оплате
  brand: 'bg-brand-soft text-brand-ink',            // «Apple Wallet + PDF», «+3% Плюс»
  neutral: 'bg-fill text-label',                    // «Сектор A4, Ряд 7»
  // Поверх фото — фиксированные светлые цвета, не зависят от темы
  glass: 'bg-white/85 text-[#1B1B1B] backdrop-blur-md',
  glassSuccess: 'bg-[#E8F8EE]/95 text-[#006E28] backdrop-blur-md',
};

export default function Badge({ tone = 'neutral', icon, size = 'md', className = '', children }) {
  const box = size === 'sm' ? 'gap-0.5 px-1.5 py-0.5 text-caption2' : 'gap-1 px-2.5 py-1 text-caption1';
  return (
    <span
      className={`inline-flex max-w-full items-center whitespace-nowrap rounded-chip font-semibold ${box} ${TONES[tone]} ${className}`}
    >
      {icon && <Icon name={icon} className={size === 'sm' ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0'} />}
      <span className="truncate">{children}</span>
    </span>
  );
}
