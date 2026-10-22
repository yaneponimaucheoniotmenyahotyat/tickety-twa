import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { COVERS, EVENT_CATEGORIES, MAX_ZONES, SEATING, eventError, seatingOf } from '../../../shared/eventRules.js';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import EventCover from '@/components/event/EventCover';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import PageLoader from '@/components/ui/PageLoader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Toggle from '@/components/ui/Toggle';
import { applyEventChange } from '@/data/eventsStore';
import { useServerAccount } from '@/hooks/useServerAccount';
import { adminCreateEvent, adminEvents, adminUpdateEvent } from '@/lib/api';
import { CITIES } from '@/data/mockData';
import { haptic, setClosingConfirmation } from '@/lib/telegram';
import { AdminGate } from './AdminPage';

// Время события — московское, как и везде в приложении (format.js), независимо от телефона
const MSK = '+03:00';
function toMskInput(iso) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

const EMPTY = {
  title: '',
  category: 'concert',
  date: '',
  doorsOpen: '',
  venue: '',
  city: CITIES[0],
  address: '',
  description: '',
  tags: '',
  cover: COVERS[0],
  sourceUrl: '',
  published: true,
  zones: [{ key: 'n1', label: 'Танцпол', nominal: '', seating: 'free' }],
};

// Событие с сервера → состояние формы (поля ввода — строки)
const toForm = (e) => ({
  title: e.title,
  category: e.category,
  date: toMskInput(e.date),
  doorsOpen: e.doorsOpen ?? '',
  venue: e.venue,
  city: e.city,
  address: e.address ?? '',
  description: e.description ?? '',
  tags: (e.tags ?? []).join(', '),
  cover: e.cover,
  sourceUrl: e.sourceUrl ?? '',
  published: e.status === 'published',
  zones: e.zones.map((z) => ({ key: z.id, id: z.id, label: z.label, nominal: String(z.nominal), seating: seatingOf(z) })),
});

// Форма → тело запроса /api/admin/events
const toBody = (f) => ({
  title: f.title.trim(),
  category: f.category,
  date: f.date ? `${f.date}:00${MSK}` : '',
  doorsOpen: f.doorsOpen || null,
  venue: f.venue.trim(),
  city: f.city.trim(),
  address: f.address.trim(),
  description: f.description.trim(),
  tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6),
  cover: f.cover,
  sourceUrl: f.sourceUrl.trim() || null,
  status: f.published ? 'published' : 'hidden',
  zones: f.zones.map((z) => ({
    ...(z.id ? { id: z.id } : {}),
    label: z.label.trim(),
    nominal: Number(z.nominal),
    seating: z.seating,
  })),
});

const input = 'mt-0.5 h-11 w-full rounded-xl bg-fill px-3 text-body outline-none placeholder:text-label-tertiary';

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block px-1 text-footnote text-label-secondary">{label}</span>
    {children}
    {hint && <span className="mt-1 block px-1 text-caption1 text-label-tertiary">{hint}</span>}
  </label>
);

let keySeq = 1;

function ZoneRow({ zone, onChange, onRemove, canRemove }) {
  return (
    <div className="space-y-2 rounded-2xl bg-fill/50 p-3">
      <div className="flex gap-2">
        <input
          value={zone.label}
          onChange={(e) => onChange({ label: e.target.value.slice(0, 40) })}
          placeholder="Название зоны"
          className="h-10 min-w-0 flex-1 rounded-lg bg-surface px-3 text-body outline-none"
        />
        <label className="flex h-10 w-28 shrink-0 items-center rounded-lg bg-surface px-3">
          <input
            value={zone.nominal}
            onChange={(e) => onChange({ nominal: e.target.value.replace(/D/g, '').slice(0, 7) })}
            inputMode="numeric"
            placeholder="Номинал"
            className="w-full min-w-0 bg-transparent text-right text-body outline-none"
          />
          <span className="ml-1 text-label-secondary">₽</span>
        </label>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Удалить зону"
            className="pressable grid h-10 w-8 shrink-0 place-items-center text-title3 text-danger"
          >
            ×
          </button>
        )}
      </div>
      <SegmentedControl
        value={zone.seating}
        onChange={(seating) => onChange({ seating })}
        options={Object.entries(SEATING).map(([value, s]) => ({ value, label: s.label }))}
      />
    </div>
  );
}

function EventForm({ initial, eventId, activeListings }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setTouched(true);
    setServerError(null);
  };
  const setZone = (key, patch) => set({ zones: form.zones.map((z) => (z.key === key ? { ...z, ...patch } : z)) });

  useEffect(() => {
    setClosingConfirmation(touched);
    return () => setClosingConfirmation(false);
  }, [touched]);

  const body = toBody(form);
  const error = eventError(body);
  const preview = { ...body, cover: form.cover, date: body.date || new Date().toISOString() };

  const save = async () => {
    setSaving(true);
    try {
      const { event } = eventId ? await adminUpdateEvent(eventId, body) : await adminCreateEvent(body);
      applyEventChange(event);
      haptic('success');
      setTouched(false);
      navigate('/admin', { replace: true });
    } catch (e) {
      haptic('error');
      setServerError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <main className="space-y-4 px-gutter pb-[calc(130px+var(--app-safe-bottom))] pt-3">
        <EventCover event={preview} className="flex h-28 items-end rounded-2xl p-4">
          <p className="line-clamp-2 text-title3 text-white drop-shadow">{body.title || 'Название события'}</p>
        </EventCover>

        {activeListings > 0 && (
          <p className="rounded-xl bg-brand-soft/60 px-4 py-3 text-footnote">
            В продаже {activeListings} — их номинал не изменится. Новые объявления пойдут по новому прайсу.
          </p>
        )}

        <section className="card space-y-3 p-4">
          <Field label="Название">
            <input value={form.title} onChange={(e) => set({ title: e.target.value.slice(0, 120) })} className={input} />
          </Field>
          <div className="chips-scroll -mx-4 px-4">
            {Object.entries(EVENT_CATEGORIES).map(([id, label]) => (
              <Chip key={id} size="sm" variant="brand" active={form.category === id} onClick={() => set({ category: id })}>
                {label}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
            <Field label="Начало (МСК)">
              <input type="datetime-local" value={form.date} onChange={(e) => set({ date: e.target.value })} className={input} />
            </Field>
            <Field label="Вход с">
              <input type="time" value={form.doorsOpen} onChange={(e) => set({ doorsOpen: e.target.value })} className={input} />
            </Field>
          </div>
          <Field label="Площадка">
            <input value={form.venue} onChange={(e) => set({ venue: e.target.value.slice(0, 120) })} className={input} />
          </Field>
          <Field label="Город">
            <input value={form.city} list="admin-cities" onChange={(e) => set({ city: e.target.value.slice(0, 60) })} className={input} />
            <datalist id="admin-cities">
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Адрес">
            <input value={form.address} onChange={(e) => set({ address: e.target.value.slice(0, 200) })} className={input} />
          </Field>
          <Field label="Описание">
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value.slice(0, 1000) })}
              rows={3}
              className="mt-0.5 w-full rounded-xl bg-fill px-3 py-2 text-body outline-none"
            />
          </Field>
          <Field label="Теги" hint="Через запятую, до 6: «Рок, 18+»">
            <input value={form.tags} onChange={(e) => set({ tags: e.target.value.slice(0, 200) })} className={input} />
          </Field>
          <div>
            <span className="block px-1 text-footnote text-label-secondary">Обложка</span>
            <div className="mt-1 flex gap-2">
              {COVERS.map((c) => (
                <button
                  key={c.join()}
                  type="button"
                  aria-label="Палитра обложки"
                  onClick={() => set({ cover: c })}
                  className={`h-10 flex-1 rounded-xl ${form.cover.join() === c.join() ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${c[0]}, ${c[1]} 60%, ${c[2]})` }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <div>
            <h2 className="text-headline">Прайс зон</h2>
            <p className="text-footnote text-label-secondary">
              Номинал — максимальная цена билета в зоне по официальному прайсу. Дороже продать будет нельзя.
            </p>
          </div>
          {form.zones.map((z) => (
            <ZoneRow
              key={z.key}
              zone={z}
              canRemove={form.zones.length > 1}
              onChange={(patch) => setZone(z.key, patch)}
              onRemove={() => set({ zones: form.zones.filter((x) => x.key !== z.key) })}
            />
          ))}
          {form.zones.length < MAX_ZONES && (
            <Button
              variant="soft"
              block
              onClick={() => set({ zones: [...form.zones, { key: `n${++keySeq}`, label: '', nominal: '', seating: 'seats' }] })}
            >
              + Добавить зону
            </Button>
          )}
          <Field label="Откуда прайс" hint="Ссылка на страницу организатора — чтобы потом можно было сверить">
            <input
              value={form.sourceUrl}
              onChange={(e) => set({ sourceUrl: e.target.value.slice(0, 500) })}
              placeholder="https://"
              inputMode="url"
              className={input}
            />
          </Field>
        </section>

        <section className="card flex items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block text-body">Показывать на витрине</span>
            <span className="block text-footnote text-label-secondary">
              Скрытое событие не видно покупателям, на него нельзя выставить билет
            </span>
          </span>
          <Toggle checked={form.published} onChange={(published) => set({ published })} label="Показывать на витрине" />
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-separator/60 bg-bg/90 px-gutter pb-[calc(12px+var(--app-safe-bottom))] pt-3 backdrop-blur-xl">
        {(serverError || (touched && error)) && (
          <p className="mb-2 text-center text-footnote text-danger">{serverError ?? error}</p>
        )}
        <Button size="lg" block disabled={Boolean(error) || !touched} loading={saving} onClick={save}>
          {eventId ? 'Сохранить' : 'Добавить событие'}
        </Button>
      </footer>
    </>
  );
}

export default function AdminEventPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const account = useServerAccount();
  const [state, setState] = useState(isNew ? { status: 'ok', event: null } : { status: 'loading' });

  useEffect(() => {
    if (isNew || account.status !== 'ok' || !account.user.isAdmin) return;
    adminEvents()
      .then(({ events }) => {
        const event = events.find((e) => e.id === id);
        setState(event ? { status: 'ok', event } : { status: 'error', message: 'Событие не найдено' });
      })
      .catch((e) => setState({ status: 'error', message: e.message }));
  }, [id, isNew, account]);

  return (
    <>
      <TopBar title={isNew ? 'Новое событие' : 'Событие'} left={<BackLink label="Админка" />} />
      <AdminGate account={account}>
        {state.status === 'loading' ? (
          <PageLoader />
        ) : state.status === 'error' ? (
          <p className="px-gutter py-10 text-center text-subhead text-danger">{state.message}</p>
        ) : (
          <EventForm
            initial={state.event ? toForm(state.event) : EMPTY}
            eventId={state.event?.id}
            activeListings={state.event?.activeListings ?? 0}
          />
        )}
      </AdminGate>
    </>
  );
}
