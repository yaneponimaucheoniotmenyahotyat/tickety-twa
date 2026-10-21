// Проверка initData Mini App по алгоритму из документации Telegram:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//   secret = HMAC_SHA256(key = "WebAppData", data = BOT_TOKEN)
//   hash   = hex(HMAC_SHA256(key = secret, data = data_check_string))
// data_check_string — все поля, кроме hash, в виде key=value, отсортированные по ключу, через \n.
import { createHmac, timingSafeEqual } from 'node:crypto';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

const secretFor = (botToken) => createHmac('sha256', 'WebAppData').update(botToken).digest();

function dataCheckString(params) {
  return [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export function validateInitData(raw, botToken, { maxAgeSec = 86_400, now = Date.now() } = {}) {
  if (!botToken) throw new AuthError('server has no BOT_TOKEN');
  if (!raw) throw new AuthError('init data is missing');

  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) throw new AuthError('hash is missing');

  const expected = createHmac('sha256', secretFor(botToken)).update(dataCheckString(params)).digest();
  // Сравнение за постоянное время — не даём подбирать подпись по времени ответа
  if (!timingSafeEqual(Buffer.from(hash, 'hex'), expected)) throw new AuthError('signature mismatch');

  const authDate = Number(params.get('auth_date'));
  if (!authDate) throw new AuthError('auth_date is missing');
  if (now / 1000 - authDate > maxAgeSec) throw new AuthError('init data expired');

  let user;
  try {
    user = JSON.parse(params.get('user'));
  } catch {
    throw new AuthError('user is malformed');
  }
  if (!user?.id) throw new AuthError('user is missing');

  return {
    user,
    authDate,
    queryId: params.get('query_id') ?? null,
    startParam: params.get('start_param') ?? null,
  };
}

// Только для тестов и локальной отладки: собрать initData, подписанную как будто Telegram
export function signInitData(fields, botToken) {
  const params = new URLSearchParams(
    Object.entries(fields).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]),
  );
  const hash = createHmac('sha256', secretFor(botToken)).update(dataCheckString(params)).digest('hex');
  params.set('hash', hash);
  return params.toString();
}
