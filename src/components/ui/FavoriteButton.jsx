import Icon from '@/components/icons/Icon';
import { haptic } from '@/lib/telegram';
import { toggleFavorite, useIsFavorite } from '@/hooks/useFavorites';

// onImage — белый круг поверх обложки, plain — в шапке страницы
export default function FavoriteButton({ eventId, variant = 'onImage' }) {
  const active = useIsFavorite(eventId);
  const box =
    variant === 'onImage'
      ? 'h-9 w-9 bg-black/25 text-white backdrop-blur-md'
      : 'h-9 w-9 bg-fill text-label';
  return (
    <button
      type="button"
      aria-label={active ? 'Убрать из избранного' : 'В избранное'}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        haptic(active ? 'light' : 'medium');
        toggleFavorite(eventId);
      }}
      className={`pressable grid place-items-center rounded-full ${box}`}
    >
      <Icon
        name={active ? 'heart-filled' : 'heart'}
        className={`h-5 w-5 ${active ? 'text-[#FF3B30]' : ''}`}
      />
    </button>
  );
}
