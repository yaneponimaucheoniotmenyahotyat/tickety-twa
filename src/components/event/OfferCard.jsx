import { useNavigate } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatPrice, initials, plural, priceNote } from '@/lib/format';
import { haptic } from '@/lib/telegram';

function SellerRow({ seller }) {
  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-fill/60 px-3 py-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-caption2 font-bold text-brand-ink">
        {initials(seller.name)}
      </span>
      <span className="truncate text-footnote">
        <span className="font-semibold">{seller.name}</span>
        <span className="text-label-secondary">
          {' '}
          <span className="text-[#FF9500]">★</span> {seller.rating.toFixed(1)} ({seller.sales}{' '}
          {plural(seller.sales, ['продажа', 'продажи', 'продаж'])})
        </span>
      </span>
      <Icon name="shield-check" className="ml-auto h-5 w-5 shrink-0 text-success" />
    </div>
  );
}

export default function OfferCard({ offer }) {
  const navigate = useNavigate();
  const note = priceNote(offer.price, offer.nominal);
  const buy = () => {
    haptic('medium');
    navigate(`/checkout/${offer.id}`);
  };

  return (
    <article className={`card p-4 ${offer.own ? 'ring-2 ring-inset ring-brand/40' : ''}`}>
      {offer.own && (
        <Badge tone="brand" icon="tab-sell" className="mb-2">
          Ваше объявление
        </Badge>
      )}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-headline">{offer.title}</h3>
        {offer.verified && (
          <Badge tone="success" icon="qr" className="mt-0.5 shrink-0">
            Проверен ИИ
          </Badge>
        )}
      </div>
      <p className="mt-1 text-footnote text-label-secondary">
        {offer.details}
        {offer.quantity > 1 && ` • ${offer.quantity} ${plural(offer.quantity, ['билет', 'билета', 'билетов'])} рядом`}
      </p>

      <SellerRow seller={offer.seller} />

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-title2">{formatPrice(offer.price)}</span>
            {offer.quantity > 1 && <span className="text-footnote text-label-secondary">/ билет</span>}
            {offer.price < offer.nominal && (
              <s className="text-footnote text-label-tertiary">{formatPrice(offer.nominal)}</s>
            )}
          </div>
          <p className={`mt-0.5 text-caption1 font-medium ${note.tone === 'success' ? 'text-success' : 'text-brand'}`}>
            {note.text}
          </p>
        </div>
        {offer.own ? (
          <Button variant="soft" iconRight="chevron-right" onClick={() => navigate('/sell')}>
            Управлять
          </Button>
        ) : (
          <Button icon="bolt" onClick={buy}>
            Купить через СБП
          </Button>
        )}
      </div>
    </article>
  );
}
