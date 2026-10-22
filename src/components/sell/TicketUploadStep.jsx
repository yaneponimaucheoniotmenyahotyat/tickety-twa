import { useEffect, useMemo } from 'react';
import Icon from '@/components/icons/Icon';
import Badge from '@/components/ui/Badge';
import Chip from '@/components/ui/Chip';
import { CHECK_STEPS, MAX_FILE_MB } from '@/lib/ticketCheck';
import { formatPrice } from '@/lib/format';

function Stepper({ value, onChange, min = 1, max = 4 }) {
  const btn = 'grid h-8 w-8 place-items-center rounded-lg bg-fill text-headline disabled:opacity-40';
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Меньше">
        −
      </button>
      <span className="w-5 text-center text-headline tabular-nums">{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Больше">
        +
      </button>
    </div>
  );
}

const SeatInput = ({ label, value, onChange }) => (
  <label className="min-w-0 flex-1">
    <span className="block text-caption1 text-label-tertiary">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, 8))}
      className="mt-0.5 h-10 w-full rounded-lg bg-fill px-3 text-body outline-none"
    />
  </label>
);

// Шаг 2: загрузка файла → проверка формата (и дублей на сервере) → продавец указывает зону и места
export default function TicketUploadStep({
  file,
  check,
  zones,
  zone,
  seats,
  seatsProblem,
  quantity,
  onFile,
  onZone,
  onSeats,
  onQuantity,
}) {
  const preview = useMemo(() => (file && file.type.startsWith('image/') && !/hei[cf]/i.test(file.type) ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  return (
    <div className="space-y-3">
      <h1 className="px-1 text-title2">Загрузите билет</h1>

      {/* Нативный выбор файла: в Telegram на телефоне откроется галерея/файлы */}
      <label
        className={`card flex cursor-pointer items-center gap-3 p-4 ${check.status === 'running' ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          type="file"
          accept="application/pdf,image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // повторный выбор того же файла тоже сработает
            if (f) onFile(f);
          }}
        />
        {preview ? (
          <img src={preview} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <Icon name="qr" className="h-7 w-7" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-headline">{file ? file.name : 'Выбрать PDF или фото'}</span>
          <span className="block text-footnote text-label-secondary">
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} МБ • заменить` : `PDF, JPG, PNG или HEIC до ${MAX_FILE_MB} МБ`}
          </span>
        </span>
        <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-label-tertiary" />
      </label>

      {check.status === 'error' && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-subhead text-danger">{check.error}</p>
      )}

      {(check.status === 'running' || check.status === 'done') && (
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-headline">Проверка файла</h2>
            {check.status === 'done' && (
              <Badge tone="success" icon="check">
                {check.code ? `${check.code} найден` : check.fileKind}
              </Badge>
            )}
          </div>
          <ul className="mt-3 space-y-2.5">
            {CHECK_STEPS.map((label, i) => {
              const state = i < check.step ? 'done' : i === check.step ? 'current' : 'pending';
              return (
                <li key={label} className="flex items-center gap-3 text-subhead">
                  {state === 'done' ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-success text-white">
                      <Icon name="check" className="h-5 w-5" />
                    </span>
                  ) : state === 'current' ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-fill" />
                  )}
                  <span className={state === 'pending' ? 'text-label-tertiary' : ''}>{label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {check.status === 'done' && (
        <section className="card space-y-4 p-4">
          <div>
            <h2 className="text-headline">Где ваши места</h2>
            <p className="text-footnote text-label-secondary">
              Укажите как на билете — покупатель увидит это в объявлении
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <Chip key={z.id} size="sm" variant="brand" active={zone?.id === z.id} onClick={() => onZone(z.id)}>
                {z.label} · {formatPrice(z.nominal)}
              </Chip>
            ))}
          </div>

          {zone?.seated && (
            <>
              <div className="flex gap-2">
                {zone.needsSector && (
                  <SeatInput label="Сектор" value={seats.sector} onChange={(sector) => onSeats({ sector })} />
                )}
                <SeatInput label="Ряд" value={seats.row} onChange={(row) => onSeats({ row })} />
                <SeatInput label="Место" value={seats.seat} onChange={(seat) => onSeats({ seat })} />
              </div>
              {seatsProblem && <p className="text-footnote text-label-secondary">{seatsProblem}</p>}
            </>
          )}

          {zone && (
            <div className="flex items-center justify-between">
              <span className="text-subhead text-label-secondary">Номинал зоны</span>
              <span className="text-subhead font-semibold">{formatPrice(zone.nominal)}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-separator pt-4">
            <span>
              <span className="block text-subhead">Билетов в лоте</span>
              <span className="block text-caption1 text-label-tertiary">
                {check.codes === 1
                  ? 'В файле один билет — для нескольких загрузите файл со всеми кодами'
                  : 'Несколько — значит места рядом'}
              </span>
            </span>
            <Stepper value={quantity} onChange={onQuantity} max={Math.min(4, check.codes ?? 4)} />
          </div>
        </section>
      )}
    </div>
  );
}
