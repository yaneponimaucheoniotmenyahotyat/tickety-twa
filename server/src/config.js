// Конфигурация из переменных окружения. Ошибки — сразу при старте, а не на первом запросе.
import { fileURLToPath } from 'node:url';

const DEFAULT_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://yaneponimaucheoniotmenyahotyat.github.io',
];

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const allowDevAuth = env.ALLOW_DEV_AUTH === '1';

  if (!env.BOT_TOKEN && production) {
    throw new Error('BOT_TOKEN не задан — без него нельзя проверить, что запрос пришёл из Telegram');
  }
  if (allowDevAuth && production) {
    throw new Error('ALLOW_DEV_AUTH=1 запрещён в production: любой смог бы войти под чужим id');
  }

  return {
    production,
    port: Number(env.PORT) || 8787,
    botToken: env.BOT_TOKEN || '',
    databaseUrl: env.DATABASE_URL || '',
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : DEFAULT_ORIGINS,
    initDataMaxAge: Number(env.INIT_DATA_MAX_AGE) || 86_400,
    allowDevAuth,
    // Администраторы — Telegram id через запятую
    adminIds: new Set((env.ADMIN_IDS ?? '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isSafeInteger(n) && n > 0)),
    // Куда сохранять файлы билетов. 'off' — не сохранять (тесты)
    uploadDir:
      env.UPLOAD_DIR === 'off' ? null : env.UPLOAD_DIR || fileURLToPath(new URL('../.data/uploads', import.meta.url)),
  };
}
