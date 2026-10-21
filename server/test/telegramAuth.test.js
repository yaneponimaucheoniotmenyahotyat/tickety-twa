import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthError, signInitData, validateInitData } from '../src/telegramAuth.js';

const TOKEN = '123456:TEST-token-not-real';
const now = Date.parse('2026-10-21T12:00:00Z');
const fields = (overrides = {}) => ({
  query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
  user: { id: 279058397, first_name: 'Иван', username: 'ivan', language_code: 'ru' },
  auth_date: Math.floor(now / 1000) - 60,
  ...overrides,
});

test('принимает корректно подписанные данные', () => {
  const r = validateInitData(signInitData(fields(), TOKEN), TOKEN, { now });
  assert.equal(r.user.id, 279058397);
  assert.equal(r.user.first_name, 'Иван');
  assert.equal(r.queryId, 'AAHdF6IQAAAAAN0XohDhrOrc');
});

test('порядок полей в строке не важен — сортировка по ключу', () => {
  const raw = signInitData(fields(), TOKEN);
  const shuffled = new URLSearchParams([...new URLSearchParams(raw).entries()].reverse()).toString();
  assert.equal(validateInitData(shuffled, TOKEN, { now }).user.id, 279058397);
});

test('отклоняет подменённого пользователя', () => {
  const raw = signInitData(fields(), TOKEN);
  const forged = raw.replace(encodeURIComponent('279058397'), encodeURIComponent('111111111'));
  assert.notEqual(forged, raw);
  assert.throws(() => validateInitData(forged, TOKEN, { now }), /signature mismatch/);
});

test('отклоняет подпись другого бота', () => {
  const raw = signInitData(fields(), '999999:OTHER-bot');
  assert.throws(() => validateInitData(raw, TOKEN, { now }), AuthError);
});

test('отклоняет просроченные данные', () => {
  const raw = signInitData(fields({ auth_date: Math.floor(now / 1000) - 2 * 86_400 }), TOKEN);
  assert.throws(() => validateInitData(raw, TOKEN, { now }), /expired/);
});

test('отклоняет пустые данные, без hash и без user', () => {
  assert.throws(() => validateInitData('', TOKEN, { now }), /missing/);
  assert.throws(() => validateInitData('auth_date=1&user=%7B%7D', TOKEN, { now }), /hash/);
  const noUser = signInitData({ auth_date: Math.floor(now / 1000) }, TOKEN);
  assert.throws(() => validateInitData(noUser, TOKEN, { now }), /user/);
});

test('без BOT_TOKEN на сервере никого не пускает', () => {
  assert.throws(() => validateInitData(signInitData(fields(), TOKEN), '', { now }), /BOT_TOKEN/);
});

// Независимая реализация, написанная прямо по тексту документации Telegram, — чтобы тест
// не сводился к «сами подписали — сами проверили». Финальная сверка — с настоящей initData
// с телефона после деплоя.
test('совпадает с независимой реализацией по документации', async () => {
  const { createHmac } = await import('node:crypto');
  const raw = signInitData(fields(), TOKEN);
  const p = new URLSearchParams(raw);
  const hash = p.get('hash');
  p.delete('hash');
  const dcs = [...p.keys()].sort().map((k) => `${k}=${p.get(k)}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  assert.equal(createHmac('sha256', secret).update(dcs).digest('hex'), hash);
});
