// Конфигурация из переменных окружения. Ошибки — сразу при старте, а не на первом запросе.
import { randomBytes } from 'node:crypto';
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
  if (env.PAYMENTS_MODE && !['test', 'manual', 'off'].includes(env.PAYMENTS_MODE)) {
    throw new Error('PAYMENTS_MODE — test, manual или off');
  }
  if (env.PAYMENTS_MODE === 'manual' && !(env.PAYMENT_DETAILS ?? '').trim()) {
    throw new Error('PAYMENTS_MODE=manual: укажите PAYMENT_DETAILS — куда покупатели переводят деньги');
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
    // Оплата: test — тестовые деньги; manual — покупатель переводит владельцу по PAYMENT_DETAILS,
    // владелец подтверждает и сам платит продавцам; off — покупка выключена.
    // Настоящий эквайринг — после договора с платёжным сервисом («Безопасная сделка»).
    paymentsMode: env.PAYMENTS_MODE ?? (production ? 'off' : 'test'),
    // Без согласия с офертой нельзя продавать и покупать. OFFER_REQUIRED=0 — выключить (тесты)
    offerRequired: env.OFFER_REQUIRED !== '0',
    // Реквизиты для ручного режима — только в .env, в код и git не попадают
    paymentDetails: (env.PAYMENT_DETAILS ?? '').trim(),
    // Подпись ссылок на файлы билетов, если нет BOT_TOKEN (тесты)
    linkSecret: randomBytes(32).toString('hex'),
    // Администраторы — Telegram id через запятую
    adminIds: new Set((env.ADMIN_IDS ?? '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isSafeInteger(n) && n > 0)),
    // Только для отладки распознавания кодов: KEEP_REJECTED=1 сохраняет файлы, на которых код
    // не нашёлся, в .data/rejected. В production выключено всегда — это чужие файлы.
    rejectedDir:
      !production && env.KEEP_REJECTED === '1' ? fileURLToPath(new URL('../.data/rejected', import.meta.url)) : null,
    // Куда сохранять файлы билетов. 'off' — не сохранять (тесты)
    uploadDir:
      env.UPLOAD_DIR === 'off' ? null : env.UPLOAD_DIR || fileURLToPath(new URL('../.data/uploads', import.meta.url)),
  };
}
