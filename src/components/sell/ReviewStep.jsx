import Icon from '@/components/icons/Icon';
import EventCover from '@/components/event/EventCover';
import Badge from '@/components/ui/Badge';
import { formatEventDate, formatPrice } from '@/lib/format';
import { haptic } from '@/lib/telegram';

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 px-4 py-3 text-subhead">
    <span className="shrink-0 text-label-secondary">{label}</span>
    <span className="text-right font-medium">{children}</span>
  </div>
);

// Шаг 4: сводка и подтверждение владения билетом
export default function ReviewStep({ event, title, fileKind, nominal, quantity, price, confirmed, onConfirm }) {
  return (
    <div className="space-y-3">
      <h1 className="px-1 text-title2">Проверьте объявление</h1>

      <section className="card overflow-hidden">
        <div className="flex gap-3 p-4">
          <EventCover event={event} className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="text-headline">{event.title}</p>
            <p className="text-footnote text-label-secondary">
              {formatEventDate(event.date)} • {event.venue}
            </p>
          </div>
        </div>
        <div className="divide-y divide-separator border-t border-separator">
          <Row label="Места">{title}</Row>
          <Row label="Билетов">{quantity}</Row>
          <Row label="Формат">
            <Badge tone="success" icon="check" size="sm">
              {fileKind} • файл проверен
            </Badge>
          </Row>
          <Row label="Цена за билет">
            {formatPrice(price)} <span className="font-normal text-label-tertiary">/ номинал {formatPrice(nominal)}</span>
          </Row>
          <Row label="Сумма лота">
            <span className="text-brand">{formatPrice(price * quantity)}</span>
          </Row>
        </div>
      </section>

      <aside className="flex gap-3 rounded-2.5xl bg-success-soft p-4">
        <Icon name="shield-check" className="h-6 w-6 shrink-0 text-success" />
        <p className="text-footnote text-label-secondary">
          Объявление увидят все покупатели Tickety. Снять его можно в любой момент в разделе «Продать».
        </p>
      </aside>

      <button
        type="button"
        role="checkbox"
        aria-checked={confirmed}
        onClick={() => {
          haptic('selection');
          onConfirm(!confirmed);
        }}
        className="card flex w-full items-start gap-3 p-4 text-left"
      >
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors ${
            confirmed ? 'bg-brand text-white' : 'bg-fill'
          }`}
        >
          {confirmed && <Icon name="check" className="h-6 w-6" />}
        </span>
        <span className="text-subhead">
          Подтверждаю, что билет принадлежит мне и не продаётся на других площадках
        </span>
      </button>
    </div>
  );
}
