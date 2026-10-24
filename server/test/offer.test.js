import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFER } from '../../shared/legal/offer.js';
import { files, multipart, setup, tma, users, verifyPhone } from './helpers.js';

let ctx;
const req = (user, method, url, payload) => ctx.app.inject({ method, url, payload, headers: { authorization: tma(user) } });

before(async () => {
  ctx = await setup({ offer: true });
  await verifyPhone(ctx.app, users.alice);
});
after(() => ctx.close());

test('новый пользователь видит, что оферту нужно принять', async () => {
  const { user } = (await req(users.alice, 'GET', '/api/me')).json();
  assert.deepEqual(
    { version: user.offer.version, accepted: user.offer.accepted, required: user.offer.required },
    { version: OFFER.version, accepted: false, required: true },
  );
});

test('без согласия нельзя продавать и покупать, но смотреть витрину и писать в поддержку — можно', async () => {
  const { payload, headers } = await multipart({ eventId: 'mumiy-troll-vk' }, files.pdf());
  const upload = await ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers: { ...headers, authorization: tma(users.alice) } });
  assert.equal(upload.statusCode, 403);
  assert.equal(upload.json().error, 'offer_required');

  const buy = await req(users.bob, 'POST', '/api/orders', { listingId: '00000000-0000-4000-8000-000000000000' });
  assert.equal(buy.json().error, 'offer_required');

  assert.equal((await ctx.app.inject('/api/events')).statusCode, 200);
  assert.equal((await req(users.bob, 'POST', '/api/support/threads', { category: 'question', body: 'Где оферта целиком?' })).statusCode, 201);
});

test('устаревшую редакцию принять нельзя; текущую — да, и продажа открывается', async () => {
  assert.equal((await req(users.alice, 'POST', '/api/me/accept-offer', { version: '2000-01-01' })).statusCode, 409);

  const accepted = await req(users.alice, 'POST', '/api/me/accept-offer', { version: OFFER.version });
  assert.equal(accepted.statusCode, 200);
  assert.ok(accepted.json().offer.acceptedAt);
  assert.equal((await req(users.alice, 'POST', '/api/me/accept-offer', { version: OFFER.version })).statusCode, 200, 'повторно — без ошибки');
  assert.equal((await req(users.alice, 'GET', '/api/me')).json().user.offer.accepted, true);

  const { payload, headers } = await multipart({ eventId: 'mumiy-troll-vk' }, files.pdf());
  const upload = await ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers: { ...headers, authorization: tma(users.alice) } });
  assert.equal(upload.statusCode, 201);
});

test('новая редакция требует нового согласия', async () => {
  // Согласие хранится по версии: принятая когда-то другая редакция не считается
  await ctx.db.query(`UPDATE legal_acceptances SET version = 'старая' WHERE user_id = $1`, [users.alice.id]);
  assert.equal((await req(users.alice, 'GET', '/api/me')).json().user.offer.accepted, false);
});
