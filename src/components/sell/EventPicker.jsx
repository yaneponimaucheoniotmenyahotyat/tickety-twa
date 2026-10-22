import { useMemo, useState } from 'react';
import Icon from '@/components/icons/Icon';
import EventCover from '@/components/event/EventCover';
import { useEvents } from '@/hooks/useEvents';
import { formatEventDate } from '@/lib/format';

// Шаг 1: продавать можно только на события из каталога — у них есть прайс зон (номинал)
export default function EventPicker({ selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const events = useEvents();
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => new Date(e.date) > Date.now())
      .filter((e) => !q || [e.title, e.venue, e.city].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [query, events]);

  return (
    <div className="space-y-3">
      <h1 className="px-1 text-title2">На какое событие билет?</h1>
      <label className="flex h-11 items-center gap-2 rounded-xl bg-fill px-3">
        <Icon name="search" className="h-4 w-4 shrink-0 text-label-tertiary" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Артист, площадка, город"
          className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-label-tertiary"
        />
      </label>

      <div className="card divide-y divide-separator overflow-hidden">
        {list.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onSelect(e.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-fill/60"
          >
            <EventCover event={e} className="h-11 w-11 shrink-0 rounded-xl" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-headline">{e.title}</span>
              <span className="block truncate text-footnote text-label-secondary">
                {formatEventDate(e.date)} • {e.venue}
              </span>
            </span>
            {selectedId === e.id ? (
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-white">
                <Icon name="check" className="h-6 w-6" />
              </span>
            ) : (
              <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-label-tertiary" />
            )}
          </button>
        ))}
        {list.length === 0 && (
          <p className="px-4 py-6 text-center text-subhead text-label-secondary">Ничего не нашлось</p>
        )}
      </div>
      <p className="px-4 text-caption1 text-label-tertiary">
        Нет нужного события? Мы добавляем события вручную по официальному прайсу — напишите в поддержку.
      </p>
    </div>
  );
}
