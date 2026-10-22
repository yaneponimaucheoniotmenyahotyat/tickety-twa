import { useMemo, useState } from 'react';
import { useEventsState } from '@/hooks/useEvents';
import { useListingOffers } from '@/hooks/useListings';
import Icon from '@/components/icons/Icon';
import { AvatarButton } from '@/components/layout/TopBar';
import EventCard from '@/components/event/EventCard';
import FiltersSheet from '@/components/home/FiltersSheet';
import SearchBar from '@/components/home/SearchBar';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import DemoNotice from '@/components/ui/DemoNotice';
import PageLoader from '@/components/ui/PageLoader';
import SafeDealNotice from '@/components/ui/SafeDealNotice';
import { refreshEvents } from '@/data/eventsStore';
import { CATEGORIES } from '@/data/mockData';
import { DEFAULT_FILTERS, SORTS, countActiveFilters, searchEvents } from '@/lib/search';
import { haptic } from '@/lib/telegram';

const SORT_ORDER = Object.keys(SORTS);

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState('popularity');
  const [sheetOpen, setSheetOpen] = useState(false);

  // Объявления с сервера приходят асинхронно — пересчитываем выдачу, когда они обновились
  const listingOffers = useListingOffers();
  const catalog = useEventsState();
  const results = useMemo(
    () => searchEvents({ query, filters, sort }),
    [query, filters, sort, listingOffers, catalog.events],
  );

  const cycleSort = () => {
    haptic('selection');
    setSort((s) => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]);
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-bg/80 pt-safe-t backdrop-blur-xl">
        <div className="flex h-12 items-center justify-between px-gutter">
          <span className="text-title3 font-bold tracking-tight">Tickety</span>
          <AvatarButton />
        </div>
      </header>

      <main className="px-gutter pb-6">
        <DemoNotice className="mb-3" />
        <SearchBar
          value={query}
          onChange={setQuery}
          onOpenFilters={() => {
            haptic('light');
            setSheetOpen(true);
          }}
          filtersActive={countActiveFilters(filters) > 0}
        />

        <div className="chips-scroll -mx-gutter mt-3 px-gutter">
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              active={filters.category === c.id}
              onClick={() => setFilters((f) => ({ ...f, category: c.id }))}
            >
              {c.label}
            </Chip>
          ))}
        </div>

        <div className="mb-3 mt-6 flex items-end justify-between gap-3">
          <h1 className="text-title1">События рядом</h1>
          <div className="shrink-0 pb-1 text-right">
            <p className="text-caption1 text-label-tertiary">
              Найдено: {results.length}
            </p>
            <button type="button" onClick={cycleSort} className="flex items-center text-footnote font-semibold text-brand">
              {SORTS[sort].label}
              <Icon name="chevron-right" className="h-4 w-4 rotate-90" />
            </button>
          </div>
        </div>

        {catalog.status === 'loading' ? (
          <PageLoader label="Загружаем события…" />
        ) : catalog.status === 'error' ? (
          <div className="card flex flex-col items-center px-6 py-10 text-center">
            <p className="text-headline text-danger">Не удалось загрузить события</p>
            <p className="mt-1 text-subhead text-label-secondary">{catalog.error?.message}</p>
            <Button className="mt-4" variant="plain" onClick={refreshEvents}>
              Повторить
            </Button>
          </div>
        ) : catalog.events.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-10 text-center">
            <Icon name="calendar" className="h-8 w-8 text-label-tertiary" />
            <p className="mt-3 text-headline">Скоро здесь появятся события</p>
            <p className="mt-1 text-subhead text-label-secondary">
              Мы добавляем события вручную, с официальным прайсом организатора
            </p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            {results.map((r) => (
              <EventCard key={r.event.id} event={r.event} minPrice={r.minPrice} allVerified={r.allVerified} />
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center px-6 py-10 text-center">
            <Icon name="search" className="h-8 w-8 text-label-tertiary" />
            <p className="mt-3 text-headline">Ничего не нашлось</p>
            <p className="mt-1 text-subhead text-label-secondary">Измените запрос или ослабьте фильтры</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setFilters(DEFAULT_FILTERS);
              }}
              className="mt-4 text-body font-semibold text-brand"
            >
              Сбросить всё
            </button>
          </div>
        )}

        <SafeDealNotice className="mt-6" />
      </main>

      <FiltersSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={filters}
        query={query}
        onApply={(f) => {
          setFilters(f);
          setSheetOpen(false);
        }}
      />
    </>
  );
}
