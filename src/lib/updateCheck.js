// Автообновление после деплоя.
// GitHub Pages отдаёт index.html с Cache-Control: max-age=600, а WebView Telegram
// держит кэш ещё дольше — без этого пользователи видят старую сборку.
// Сравниваем имя своего бандла (index-<hash>.js) с тем, что указан в свежем index.html.
import { tg } from './telegram';

const CHECK_INTERVAL_MS = 60_000;
const RELOADED_KEY = 'tickety:reloaded-for';
const BUNDLE_RE = /assets\/(index-[\w-]+\.js)/;

const currentBundle = new URL(import.meta.url).pathname.split('/').pop();
let lastCheck = 0;

async function check() {
  if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = Date.now();
  try {
    const res = await fetch(`./?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = (await res.text()).match(BUNDLE_RE)?.[1];
    if (!latest || latest === currentBundle) return;
    // Защита от цикла: на одну и ту же версию перезагружаемся не больше раза
    if (sessionStorage.getItem(RELOADED_KEY) === latest) return;
    sessionStorage.setItem(RELOADED_KEY, latest);
    location.reload();
  } catch {
    /* офлайн или хранилище недоступно — попробуем в следующий раз */
  }
}

export function startUpdateCheck() {
  // В dev бандла с хэшем нет — проверять нечего
  if (!import.meta.env.PROD || !BUNDLE_RE.test(import.meta.url)) return;
  check();
  // Mini App часто не закрывают, а сворачивают — проверяем при возврате
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  tg?.onEvent?.('activated', check); // Bot API 8.0+
}
