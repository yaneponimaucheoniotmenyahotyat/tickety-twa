import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/icons/Icon';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import RangeSlider from '@/components/ui/RangeSlider';
import Toggle from '@/components/ui/Toggle';
import { CATEGORIES, CITIES, PRICE_LIMIT, events, getVenues } from '@/data/mockData';
import { AVERAGE_PRICE, DEFAULT_FILTERS, searchEvents } from '@/lib/search';
import { formatPrice, plural } from '@/lib/format';
import { haptic } from '@/lib/telegram';

const SectionTitle = ({ children, aside }) => (
  <div className="mb-2 mt-5 flex items-baseline justify-between px-1">
    <h3 className="text-footnote font-medium uppercase tracking-wide text-label-secondary">{children}</h3>
    {aside}
  </div>
);

function ToggleRow({ icon, iconClass, title, badge, subtitle, checked, onChange }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconClass}`}>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-body">
          {title}
          {badge && (
            <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-caption2 font-bold uppercase tracking-wide text-success">
              {badge}
            </span>
          )}
        </p>
        <p className="text-footnote text-label-secondary">{subtitle}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

// Черновик фильтров живёт в шторке; на витрину уходит только по «Применить».
export default function FiltersSheet({ open, onClose, value, onApply, query }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const count = useMemo(() => searchEvents({ query, filters: draft }).length, [query, draft]);
  const venuesInCity = draft.city ? new Set(events.filter((e) => e.city === draft.city).map((e) => e.venue)).size : getVenues().length;
  const venueSuggestions = getVenues().filter(
    (v) => v !== draft.venue && (!draft.city || events.some((e) => e.venue === v && e.city === draft.city)),
  );
  const [lo, hi] = draft.price;

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="text-title3">Параметры поиска</h2>
      <button
        type="button"
        onClick={() => {
          haptic('light');
          setDraft({ ...DEFAULT_FILTERS, category: draft.category });
        }}
        className="text-body text-brand"
      >
        Сбросить
      </button>
    </div>
  );

  const footer = (
    <Button
      size="lg"
      block
      iconRight="arrow-right"
      disabled={count === 0}
      onClick={() => {
        haptic('medium');
        onApply(draft);
      }}
    >
      Применить
      <span className="font-normal opacity-80">
        • {count} {plural(count, ['событие', 'события', 'событий'])}
      </span>
    </Button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} header={header} footer={footer}>
      <SectionTitle>Город проведения</SectionTitle>
      <label className="card relative flex items-center gap-3 p-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand">
          <Icon name="pin" className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-headline">{draft.city ?? 'Все города'}</span>
          <span className="block text-footnote text-label-secondary">
            {venuesInCity} {plural(venuesInCity, ['площадка', 'площадки', 'площадок'])}
          </span>
        </span>
        <span className="flex items-center text-body text-brand">
          Изменить
          <Icon name="chevron-right" className="h-5 w-5 rotate-90" />
        </span>
        {/* Нативный select: на iOS открывается системный барабан */}
        <select
          aria-label="Город"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={draft.city ?? ''}
          onChange={(e) => set({ city: e.target.value || null, venue: '' })}
        >
          <option value="">Все города</option>
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <SectionTitle>Тип мероприятия</SectionTitle>
      <div className="chips-scroll -mx-gutter px-gutter">
        {CATEGORIES.map((c) => (
          <Chip key={c.id} variant="brand" active={draft.category === c.id} onClick={() => set({ category: c.id })}>
            {c.id === 'all' ? 'Все' : c.label}
          </Chip>
        ))}
      </div>

      <SectionTitle>Организатор / Площадка</SectionTitle>
      <div className="card flex items-center gap-3 p-2 pl-3">
        <Icon name="seat" className="h-6 w-6 shrink-0 text-label-tertiary" />
        <input
          value={draft.venue}
          onChange={(e) => set({ venue: e.target.value })}
          placeholder="Например: VK Stadium"
          className="h-10 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-label-tertiary"
        />
        {draft.venue && (
          <button
            type="button"
            aria-label="Очистить"
            onClick={() => set({ venue: '' })}
            className="grid h-7 w-7 place-items-center rounded-full bg-fill text-label-secondary"
          >
            ✕
          </button>
        )}
      </div>
      <div className="chips-scroll -mx-gutter mt-2 px-gutter">
        {venueSuggestions.map((v) => (
          <Chip key={v} size="sm" onClick={() => set({ venue: v })}>
            {v}
          </Chip>
        ))}
      </div>

      <SectionTitle
        aside={
          <span className="text-headline text-brand">
            {formatPrice(lo)} — {hi >= PRICE_LIMIT ? `${formatPrice(PRICE_LIMIT)}+` : formatPrice(hi)}
          </span>
        }
      >
        Диапазон цены
      </SectionTitle>
      <div className="card px-4 pb-3 pt-5">
        <RangeSlider max={PRICE_LIMIT} step={100} value={draft.price} onChange={(price) => set({ price })} />
        <div className="mt-3 flex justify-between text-caption1 text-label-tertiary">
          <span>0 ₽</span>
          <span className="text-footnote text-label-secondary">Средняя: {formatPrice(AVERAGE_PRICE)}</span>
          <span>20 000+ ₽</span>
        </div>
      </div>

      <SectionTitle>Надёжность и проход</SectionTitle>
      <div className="card divide-y divide-separator">
        <ToggleRow
          icon="shield-check"
          iconClass="bg-success-soft text-success"
          title="Проверены ИИ"
          badge="Гарантия"
          subtitle="Штрихкод и PDF валидированы"
          checked={draft.aiVerified}
          onChange={(aiVerified) => set({ aiVerified })}
        />
        <ToggleRow
          icon="contactless"
          iconClass="bg-brand-soft text-brand"
          title="Электронный проход"
          subtitle="QR-код или Apple Wallet"
          checked={draft.eTicket}
          onChange={(eTicket) => set({ eTicket })}
        />
        <ToggleRow
          icon="seat"
          iconClass="bg-fill text-label-secondary"
          title="Только места рядом"
          subtitle="Для покупок от 2-х билетов"
          checked={draft.together}
          onChange={(together) => set({ together })}
        />
      </div>
    </BottomSheet>
  );
}
