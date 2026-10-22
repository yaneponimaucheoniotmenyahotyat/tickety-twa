import Icon from '@/components/icons/Icon';
import Chip from '@/components/ui/Chip';
import { DEMO_MODE } from '@/data/mockData';
import { formatPrice, plural } from '@/lib/format';
import { MIN_PRICE } from '@/lib/ticketCheck';

export { MIN_PRICE };
const roundDown100 = (n) => Math.floor(n / 100) * 100;

// Шаг 3: цена за билет. Выше номинала — нельзя (правило «Честной цены»),
// поэтому ошибка показывается сразу, а кнопка «Далее» блокируется.
export default function PriceStep({ nominal, price, onPrice, quantity, market }) {
  const n = Number(price) || 0;
  const tooHigh = n > nominal;
  const tooLow = price !== '' && n < MIN_PRICE;

  const presets = [
    { label: 'По номиналу', value: nominal },
    { label: '−5%', value: roundDown100(nominal * 0.95) },
    { label: '−10%', value: roundDown100(nominal * 0.9) },
  ];
  if (market.min && market.min < nominal) presets.push({ label: `Как у самого дешёвого`, value: market.min });

  return (
    <div className="space-y-3">
      <h1 className="px-1 text-title2">Цена за билет</h1>

      <section className="card p-5 text-center">
        <label className="flex items-baseline justify-center gap-1">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={price}
            onChange={(e) => onPrice(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={String(nominal)}
            aria-label="Цена за билет"
            className={`w-40 bg-transparent text-right text-large-title tabular-nums outline-none placeholder:text-label-tertiary ${
              tooHigh ? 'text-danger' : ''
            }`}
          />
          <span className="text-title1 text-label-secondary">₽</span>
        </label>
        <p className={`mt-1 text-footnote ${tooHigh ? 'font-medium text-danger' : 'text-label-secondary'}`}>
          {tooHigh
            ? `Выше номинала ${formatPrice(nominal)} продавать нельзя`
            : tooLow
              ? `Минимальная цена — ${formatPrice(MIN_PRICE)}`
              : `Номинал ${formatPrice(nominal)} — это максимум`}
        </p>
        <div className="chips-scroll -mx-5 mt-4 justify-start px-5">
          {presets.map((p) => (
            <Chip key={p.label} size="sm" variant="brand" active={n === p.value} onClick={() => onPrice(String(p.value))}>
              {p.label}
            </Chip>
          ))}
        </div>
      </section>

      {market.count > 0 && (
        <section className="card flex gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <p className="text-subhead">
            В этой зоне сейчас {market.count} {plural(market.count, ['предложение', 'предложения', 'предложений'])} от{' '}
            <b>{formatPrice(market.min)}</b>.{' '}
            <span className="text-label-secondary">
              {n && n <= market.min ? 'Ваша цена самая выгодная — продастся быстрее.' : 'Цена ниже — быстрее продажа.'}
            </span>
          </p>
        </section>
      )}

      <section className="card divide-y divide-separator">
        <div className="flex justify-between px-4 py-3 text-subhead">
          <span className="text-label-secondary">Комиссия Tickety</span>
          <span className="text-success">0 ₽</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span>
            <span className="block text-headline">Сумма лота</span>
            <span className="block text-caption1 text-label-tertiary">
              {[quantity > 1 && `${quantity} × ${formatPrice(n)}`, DEMO_MODE && 'после прохода покупателя']
                .filter(Boolean)
                .join(', ')}
            </span>
          </span>
          <span className="text-title2 tabular-nums text-brand">{formatPrice(tooHigh ? 0 : n * quantity)}</span>
        </div>
      </section>
    </div>
  );
}
