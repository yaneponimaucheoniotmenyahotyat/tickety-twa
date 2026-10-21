// Тонкая обёртка над официальным window.Telegram.WebApp.
// Все вызовы безопасны вне Telegram (обычный браузер на этапе разработки)
// и на старых клиентах — каждый метод проверяется по версии Bot API.

export const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

// Скрипт создаёт объект и в обычном браузере, но initData там пустая.
export const isTelegram = Boolean(tg?.initData);

const supports = (version) => Boolean(tg?.isVersionAtLeast?.(version));

function hexToRgbChannels(hex) {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return null;
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

// themeParams → токены --app-* (бренд-цвет Tickety не трогаем).
const THEME_MAP = {
  '--app-bg': ['secondary_bg_color'],
  '--app-surface': ['section_bg_color', 'bg_color'],
  '--app-separator': ['section_separator_color'],
  '--app-label': ['text_color'],
  '--app-label-2': ['subtitle_text_color', 'hint_color'],
  '--app-label-3': ['hint_color'],
};

export function applyTheme() {
  if (!tg) return;
  const root = document.documentElement;
  root.classList.toggle('dark', tg.colorScheme === 'dark');

  // Вне Telegram остаются дефолты из index.css
  if (!isTelegram) return;
  const params = tg.themeParams || {};
  for (const [cssVar, keys] of Object.entries(THEME_MAP)) {
    const hex = keys.map((k) => params[k]).find(Boolean);
    const rgb = hexToRgbChannels(hex);
    if (rgb) root.style.setProperty(cssVar, rgb);
    else root.style.removeProperty(cssVar);
  }

  // Шапка и фон Telegram сливаются с фоном приложения
  if (supports('6.1')) {
    tg.setHeaderColor('secondary_bg_color');
    tg.setBackgroundColor('secondary_bg_color');
  }
  if (supports('7.10')) tg.setBottomBarColor('secondary_bg_color');
}

export function initTelegram() {
  if (!tg) return;

  tg.ready();  // скрывает лоадер Telegram
  tg.expand(); // на весь экран

  // Главное для шторок: вертикальный свайп не закрывает Mini App,
  // пока пользователь скроллит контент (Bot API 7.7+).
  if (supports('7.7')) tg.disableVerticalSwipes();

  // Подтверждение закрытия во время оплаты включаем точечно — см. setClosingConfirmation
  applyTheme();
  tg.onEvent('themeChanged', applyTheme);
}

// ---- Нативные элементы Telegram ----

export function setClosingConfirmation(enabled) {
  if (!supports('6.2')) return;
  enabled ? tg.enableClosingConfirmation() : tg.disableClosingConfirmation();
}

export function haptic(type = 'light') {
  if (!supports('6.1')) return;
  if (['success', 'error', 'warning'].includes(type)) {
    tg.HapticFeedback.notificationOccurred(type);
  } else if (type === 'selection') {
    tg.HapticFeedback.selectionChanged();
  } else {
    tg.HapticFeedback.impactOccurred(type); // light | medium | heavy | rigid | soft
  }
}

// Внешние ссылки (карты) — через Telegram, иначе WebView откроет их внутри Mini App
export function openLink(url) {
  if (isTelegram && tg.openLink) tg.openLink(url);
  else window.open(url, '_blank', 'noopener');
}

export function getUser() {
  return tg?.initDataUnsafe?.user ?? null;
}

// Нативный диалог подтверждения Telegram; в браузере — window.confirm
export function confirmDialog(message) {
  if (isTelegram && supports('6.2')) {
    return new Promise((resolve) => tg.showConfirm(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

// Разрешение боту писать пользователю (уведомления о билетах), Bot API 6.9+.
// Вне Telegram разрешать некому — возвращаем false.
export function requestWriteAccess() {
  if (!isTelegram || !supports('6.9')) return Promise.resolve(false);
  return new Promise((resolve) => tg.requestWriteAccess((granted) => resolve(Boolean(granted))));
}

// Номер телефона через нативный диалог Telegram (Bot API 6.9+).
// Возвращает сырую подписанную строку response — её проверяет сервер, а не приложение.
// null — пользователь отказался или мы не в Telegram.
export function requestContact() {
  if (!isTelegram || !supports('6.9')) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      tg.requestContact((sent, event) => resolve(sent && event?.response ? event.response : null));
    } catch {
      resolve(null); // запрос уже открыт — повторный вызов Telegram отклоняет
    }
  });
}

// Пользователь уже разрешил писать при старте (например, открыл Mini App из чата с ботом)
export const writeAccessPreGranted = () => Boolean(tg?.initDataUnsafe?.user?.allows_write_to_pm);
