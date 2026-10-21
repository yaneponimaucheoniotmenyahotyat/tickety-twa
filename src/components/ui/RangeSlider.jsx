// Двойной слайдер на нативных input[type=range]: доступность и жесты — от браузера.
// Трек отступает на радиус ползунка (14px), чтобы заливка совпадала с центрами ползунков.
export default function RangeSlider({ min = 0, max, step = 100, value, onChange }) {
  const [lo, hi] = value;
  const pct = (v) => ((v - min) / (max - min)) * 100;
  // Если левый ползунок упёрся вправо, он должен быть сверху, иначе его не вытащить
  const loOnTop = lo > max - (max - min) * 0.1;

  return (
    <div className="relative h-7">
      <div className="absolute inset-x-3.5 top-1/2 h-1 -translate-y-1/2 rounded-full bg-fill">
        <div
          className="absolute inset-y-0 rounded-full bg-brand"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
      </div>
      <input
        type="range"
        className="dual-range"
        style={{ zIndex: loOnTop ? 4 : 3 }}
        min={min}
        max={max}
        step={step}
        value={lo}
        aria-label="Минимальная цена"
        onChange={(e) => onChange([Math.min(Number(e.target.value), hi - step), hi])}
      />
      <input
        type="range"
        className="dual-range"
        style={{ zIndex: loOnTop ? 3 : 4 }}
        min={min}
        max={max}
        step={step}
        value={hi}
        aria-label="Максимальная цена"
        onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo + step)])}
      />
    </div>
  );
}
