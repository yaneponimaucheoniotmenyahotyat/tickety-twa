import { haptic } from '@/lib/telegram';

// iOS UISwitch 51×31
export default function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic('selection');
        onChange(!checked);
      }}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-success' : 'bg-fill'
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] transition-transform duration-300 ease-ios ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}
