import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN, files, multipart, setup, tma, users, verifyPhone } from './helpers.js';

let ctx;

before(async () => {
  ctx = await setup({ seed: false }); // чистый каталог: события заводит администратор
  await verifyPhone(ctx.app, users.alice);
  await verifyPhone(ctx.app, users.bob);
});
after(() => ctx.close());

const as = (user) => ({ authorization: tma(user) });
const req = (user, method, url, payload) => ctx.app.inject({ method, url, payload, headers: as(user) });

const eventInput = (over = {}) => ({
  title: 'Кино — трибьют',
  category: 'concert',
  date: '2027-03-20T19:00:00+03:00',
  doorsOpen: '18:00',
  venue: 'Зал «Москва»',
  city: 'Москва',
  address: 'ул. Примерная, 1',
  description: 'Прайс с сайта организатора',
  tags: ['Рок'],
  cover: ['#1B2F5D', '#3D7BFF', '#F47C20'],
  sourceUrl: 'https://example.com/prices',
  status: 'published',
  zones: [
    { label: 'Танцпол', nominal: 3000, seating: 'free' },
    { label: 'Балкон', nominal: 2000, seating: 'sector' },
  ],
  ...over,
});

async function sell(user, eventId, body) {
  const { payload, headers } = await multipart({ eventId }, files.pdf());
  const check = await ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers: { ...headers, ...as(user) } });
  if (check.statusCode !== 201) return check;
  return req(user, 'POST', '/api/listings', { checkId: check.json().checkId, quantity: 1, ...body });
}

test('админка закрыта для гостей и обычных пользователей', async () => {
  assert.equal((await ctx.app.inject('/api/admin/events')).statusCode, 401);
  assert.equal((await req(users.alice, 'GET', '/api/admin/events')).statusCode, 403);
  assert.equal((await req(users.alice, 'POST', '/api/admin/events', eventInput())).statusCode, 403);
  assert.equal((await req(ADMIN, 'GET', '/api/admin/events')).statusCode, 200);
});

test('/api/me сообщает, кто администратор', async () => {
  assert.equal((await req(ADMIN, 'GET', '/api/me')).json().user.isAdmin, true);
  assert.equal((await req(users.alice, 'GET', '/api/me')).json().user.isAdmin, false);
});

test('событие без зон, с номиналом меньше 100 ₽ или с лишним полем не создаётся', async () => {
  const noZones = await req(ADMIN, 'POST', '/api/admin/events', eventInput({ zones: [] }));
  assert.equal(noZones.statusCode, 400);
  assert.match(noZones.json().message, /хотя бы одну зону/);

  const cheap = await req(ADMIN, 'POST', '/api/admin/events', eventInput({ zones: [{ label: 'Зал', nominal: 50, seating: 'seats' }] }));
  assert.equal(cheap.statusCode, 400);

  const twice = await req(ADMIN, 'POST', '/api/admin/events', eventInput({
    zones: [{ label: 'Зал', nominal: 500, seating: 'seats' }, { label: 'зал', nominal: 700, seating: 'seats' }],
  }));
  assert.match(twice.json().message, /дважды/);

  const extra = await req(ADMIN, 'POST', '/api/admin/events', eventInput({ popularity: 100 }));
  assert.equal(extra.statusCode, 400);
});

test('событие из админки: в каталоге, продажа по номиналу из прайса', async () => {
  const created = await req(ADMIN, 'POST', '/api/admin/events', eventInput());
  assert.equal(created.statusCode, 201);
  const event = created.json().event;
  assert.equal(event.zones.length, 2);
  const [dance, balcony] = event.zones;
  assert.deepEqual([balcony.seated, balcony.needsSector], [true, true]);

  const catalog = (await ctx.app.inject('/api/events')).json().events;
  assert.ok(catalog.some((e) => e.id === event.id));

  const tooHigh = await sell(users.alice, event.id, { zone: dance.id, price: 3100 });
  assert.equal(tooHigh.statusCode, 400);
  const ok = await sell(users.alice, event.id, { zone: dance.id, price: 2900 });
  assert.equal(ok.statusCode, 201);
  assert.equal(ok.json().listing.nominal, 3000);
  assert.equal(ok.json().listing.title, 'Танцпол');
});

test('правка: номинал выставленных не меняется, зону с билетами не удалить, скрытое пропадает', async () => {
  const event = (await req(ADMIN, 'POST', '/api/admin/events', eventInput({ title: 'Правка' }))).json().event;
  const [dance, balcony] = event.zones;
  const listing = (await sell(users.bob, event.id, { zone: dance.id, price: 3000 })).json().listing;

  // Номинал танцпола снизили — объявление Бориса осталось с прежним номиналом
  const cheaper = eventInput({ title: 'Правка', zones: [{ ...dance, nominal: 2500, seating: 'free' }, { ...balcony, seating: 'sector' }] });
  for (const z of cheaper.zones) delete z.seated, delete z.needsSector;
  const updated = await req(ADMIN, 'PUT', `/api/admin/events/${event.id}`, cheaper);
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().event.zones[0].nominal, 2500);
  assert.equal(updated.json().event.activeListings, 1);
  const mine = (await req(users.bob, 'GET', '/api/me/listings')).json().listings.find((l) => l.id === listing.id);
  assert.equal(mine.nominal, 3000);

  // Новые объявления — уже по новому номиналу
  assert.equal((await sell(users.alice, event.id, { zone: dance.id, price: 2600 })).statusCode, 400);

  // Убрать зону, в которой продают билеты, нельзя
  const dropDance = { ...cheaper, zones: cheaper.zones.slice(1) };
  const dropped = await req(ADMIN, 'PUT', `/api/admin/events/${event.id}`, dropDance);
  assert.equal(dropped.statusCode, 409);

  // Чужой id зоны — ошибка, а не тихое создание
  const foreign = { ...cheaper, zones: [...cheaper.zones, { id: 'zdeadbeef', label: 'Ложа', nominal: 900, seating: 'seats' }] };
  assert.equal((await req(ADMIN, 'PUT', `/api/admin/events/${event.id}`, foreign)).statusCode, 400);

  // Скрытое событие: нет в каталоге, продать нельзя, но в админке видно
  assert.equal((await req(ADMIN, 'PUT', `/api/admin/events/${event.id}`, { ...cheaper, status: 'hidden' })).statusCode, 200);
  assert.ok(!(await ctx.app.inject('/api/events')).json().events.some((e) => e.id === event.id));
  assert.equal((await sell(users.alice, event.id, { zone: dance.id, price: 1000 })).statusCode, 404);
  assert.ok((await req(ADMIN, 'GET', '/api/admin/events')).json().events.some((e) => e.id === event.id && e.status === 'hidden'));

  assert.equal((await req(ADMIN, 'PUT', '/api/admin/events/ev-none', cheaper)).statusCode, 404);
});

test('модерация: снятое объявление пропадает с витрины, продавец видит причину', async () => {
  const event = (await req(ADMIN, 'POST', '/api/admin/events', eventInput({ title: 'Модерация' }))).json().event;
  const listing = (await sell(users.alice, event.id, { zone: event.zones[0].id, price: 2000 })).json().listing;

  const queue = (await req(ADMIN, 'GET', '/api/admin/listings')).json().listings;
  const inQueue = queue.find((l) => l.id === listing.id);
  assert.equal(inQueue.seller.id, users.alice.id);
  assert.equal(inQueue.seller.blocked, false);

  assert.equal((await req(users.bob, 'POST', `/api/admin/listings/${listing.id}/remove`, { reason: 'Подделка' })).statusCode, 403);
  assert.equal((await req(ADMIN, 'POST', `/api/admin/listings/${listing.id}/remove`, {})).statusCode, 400, 'без причины нельзя');

  const removed = await req(ADMIN, 'POST', `/api/admin/listings/${listing.id}/remove`, { reason: 'Скриншот из чужого объявления' });
  assert.equal(removed.statusCode, 200);
  assert.equal((await req(ADMIN, 'POST', `/api/admin/listings/${listing.id}/remove`, { reason: 'Ещё раз' })).statusCode, 404);

  assert.ok(!(await ctx.app.inject('/api/listings')).json().listings.some((l) => l.id === listing.id));
  const mine = (await req(users.alice, 'GET', '/api/me/listings')).json().listings.find((l) => l.id === listing.id);
  assert.equal(mine.status, 'removed');
  assert.equal(mine.removedReason, 'Скриншот из чужого объявления');

  const removedQueue = (await req(ADMIN, 'GET', '/api/admin/listings?status=removed')).json().listings;
  assert.ok(removedQueue.some((l) => l.id === listing.id));
});

test('блокировка продавца снимает его объявления и закрывает продажу до разблокировки', async () => {
  const event = (await req(ADMIN, 'POST', '/api/admin/events', eventInput({ title: 'Блокировка' }))).json().event;
  const zone = event.zones[0].id;
  await sell(users.bob, event.id, { zone, price: 1500 });
  await sell(users.bob, event.id, { zone, price: 1600 });

  assert.equal((await req(ADMIN, 'POST', `/api/admin/users/${ADMIN.id}/block`, { reason: 'Тест' })).statusCode, 400);
  assert.equal((await req(ADMIN, 'POST', '/api/admin/users/424242/block', { reason: 'Нет такого' })).statusCode, 404);

  const blocked = await req(ADMIN, 'POST', `/api/admin/users/${users.bob.id}/block`, { reason: 'Продавал чужие билеты' });
  assert.equal(blocked.statusCode, 200);
  assert.ok(blocked.json().removedListings >= 2);

  assert.ok(!(await ctx.app.inject('/api/listings')).json().listings.some((l) => l.seller.name === 'Борис'));
  assert.equal((await req(users.bob, 'GET', '/api/me')).json().user.blocked, true);
  const attempt = await sell(users.bob, event.id, { zone, price: 1000 });
  assert.equal(attempt.statusCode, 403);
  assert.equal(attempt.json().error, 'blocked');

  assert.equal((await req(ADMIN, 'POST', `/api/admin/users/${users.bob.id}/unblock`)).statusCode, 200);
  assert.equal((await sell(users.bob, event.id, { zone, price: 1000 })).statusCode, 201);

  const log = await ctx.db.query(`SELECT action FROM admin_actions WHERE target_id = $1 ORDER BY created_at`, [String(users.bob.id)]);
  assert.deepEqual(log.map((r) => r.action), ['user_block', 'user_unblock']);
});

test('браузер может отправить PUT с другого адреса (CORS preflight)', async () => {
  const res = await ctx.app.inject({
    method: 'OPTIONS',
    url: '/api/admin/events/ev1',
    headers: {
      origin: 'http://127.0.0.1:5173',
      'access-control-request-method': 'PUT',
      'access-control-request-headers': 'authorization,content-type',
    },
  });
  assert.equal(res.statusCode, 204);
  assert.match(res.headers['access-control-allow-methods'], /PUT/);
});
