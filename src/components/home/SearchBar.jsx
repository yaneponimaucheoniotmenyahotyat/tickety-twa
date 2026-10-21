import Icon from '@/components/icons/Icon';

export default function SearchBar({ value, onChange, onOpenFilters, filtersActive }) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-fill px-3">
        <Icon name="search" className="h-4 w-4 shrink-0 text-label-tertiary" />
        {/* 17px: меньший шрифт заставляет iOS зумить страницу при фокусе */}
        <input
          type="search"
          enterKeyHint="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Поиск мероприятий, артистов, мест"
          className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-label-tertiary"
        />
      </label>
      <button
        type="button"
        aria-label="Фильтры"
        onClick={onOpenFilters}
        className="pressable relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fill text-label-secondary"
      >
        <Icon name="tune" className="h-6 w-6" />
        {filtersActive && (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-fill" />
        )}
      </button>
    </div>
  );
}
