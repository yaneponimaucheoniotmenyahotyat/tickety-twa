import { useNavigate } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import { getUser, isTelegram } from '@/lib/telegram';

// Стеклянная шапка в стиле UINavigationBar
export default function TopBar({ title, left, right }) {
  return (
    <header className="sticky top-0 z-20 border-b border-separator/60 bg-bg/80 pt-safe-t backdrop-blur-xl">
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-2 px-gutter">
        <div className="flex min-w-0 items-center">{left}</div>
        <h1 className="truncate text-headline">{title}</h1>
        <div className="flex items-center justify-end gap-2">{right}</div>
      </div>
    </header>
  );
}

// В Telegram «Назад» — нативная кнопка в шапке клиента; своя нужна только в браузере.
export function BackLink({ label = 'Назад' }) {
  const navigate = useNavigate();
  if (isTelegram) return null;
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="pressable -ml-1 flex items-center text-body text-brand"
    >
      <Icon name="chevron-right" className="h-6 w-6 rotate-180" />
      {label}
    </button>
  );
}

// Аватар из Telegram, если есть, иначе иконка профиля (ikonka.svg)
export function AvatarButton() {
  const navigate = useNavigate();
  const photo = getUser()?.photo_url;
  return (
    <button
      type="button"
      aria-label="Профиль"
      onClick={() => navigate('/profile')}
      className="pressable grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-brand text-white"
    >
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon name="person" className="h-6 w-6" />
      )}
    </button>
  );
}
