export const SELL_STEPS = ['Событие', 'Билет', 'Цена', 'Проверка'];

// Полоска прогресса мастера: 4 сегмента + подпись текущего шага
export default function WizardProgress({ step }) {
  return (
    <div className="px-1">
      <div className="flex gap-1.5">
        {SELL_STEPS.map((label, i) => (
          <span
            key={label}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-brand' : 'bg-fill'}`}
          />
        ))}
      </div>
      <p className="mt-2 text-footnote text-label-secondary">
        Шаг {step} из {SELL_STEPS.length} • {SELL_STEPS[step - 1]}
      </p>
    </div>
  );
}
