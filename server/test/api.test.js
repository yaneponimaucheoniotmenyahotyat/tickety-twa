import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { signInitData } from '../src/telegramAuth.js';

const TOKEN = '123456:TEST-token-not-real';
let app;
let db;

const tma = (user) =>
  `tma ${signInitData({ user, auth_date: Math.floor(Date.now() / 1000), query_id: 'q1' }, TOKEN)}`;

before(async () => {
  db = await openDb({ dataDir: 'memory://' });
  await migrate(db);
  const config = loadConfig({ BOT_TOKEN: TOKEN });
  app = await buildApp({ config, db });
});

after(async () => {
  await app.close();
  await db.close();
});

test('GET /api/health — база отвечает', async () => {
  const res = await app.inject('/api/health');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true, db: 'pglite-memory' });
});

test('GET /api/me без заголовка — 401', async () => {
  const res = await app.inject('/api/me');
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, 'unauthorized');
});

test('GET /api/me с подписью Telegram — создаёт и возвращает пользователя', async () => {
  const user = { id: 42, first_name: 'Анна', username: 'anna', is_premium: true };
  const first = await app.inject({ url: '/api/me', headers: { authorization: tma(user) } });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().isNew, true);
  assert.equal(first.json().user.firstName, 'Анна');
  assert.equal(first.json().user.isPremium, true);

  // Повторный вход: тот же пользователь, данные обновились из Telegram
  const second = await app.inject({
    url: '/api/me',
    headers: { authorization: tma({ ...user, username: 'anna_new' }) },
  });
  assert.equal(second.json().isNew, false);
  assert.equal(second.json().user.username, 'anna_new');
  const [{ count }] = await db.query('SELECT count(*)::int AS count FROM users');
  assert.equal(count, 1);
});

test('подделанная подпись — 401', async () => {
  const bad = tma({ id: 7, first_name: 'X' }).replace(/hash=[0-9a-f]{4}/, 'hash=0000');
  const res = await app.inject({ url: '/api/me', headers: { authorization: bad } });
  assert.equal(res.statusCode, 401);
});

test('dev-вход выключен по умолчанию', async () => {
  const res = await app.inject({ url: '/api/me', headers: { authorization: 'dev 1' } });
  assert.equal(res.statusCode, 401);
});

test('CORS: GitHub Pages разрешён, чужой сайт — нет', async () => {
  const ok = await app.inject({
    method: 'OPTIONS',
    url: '/api/me',
    headers: {
      origin: 'https://yaneponimaucheoniotmenyahotyat.github.io',
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization',
    },
  });
  assert.equal(ok.headers['access-control-allow-origin'], 'https://yaneponimaucheoniotmenyahotyat.github.io');

  const evil = await app.inject({
    method: 'OPTIONS',
    url: '/api/me',
    headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
  });
  assert.equal(evil.headers['access-control-allow-origin'], undefined);
});

test('production не стартует с ALLOW_DEV_AUTH=1 или без BOT_TOKEN', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production', BOT_TOKEN: 'x', ALLOW_DEV_AUTH: '1' }), /ALLOW_DEV_AUTH/);
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /BOT_TOKEN/);
});
