import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { files, multipart, setup, tma, users, verifyPhone } from './helpers.js';

// Событие из shared/catalog.js с датой в будущем (14.02.2027)
const EVENT = 'mumiy-troll-vk';
let ctx;

before(async () => {
  ctx = await setup();
  // Продавать можно только с подтверждённым номером — здесь проверяем остальную логику
  await verifyPhone(ctx.app, users.alice);
  await verifyPhone(ctx.app, users.bob);
});
after(() => ctx.close());

async function upload(user, file, eventId = EVENT) {
  const { payload, headers } = multipart({ eventId }, file);
  return ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers: { ...headers, authorization: tma(user) } });
}

const createListing = (user, body) =>
  ctx.app.inject({ method: 'POST', url: '/api/listings', payload: body, headers: { authorization: tma(user) } });

test('загрузка без входа — 401', async () => {
  const { payload, headers } = multipart({ eventId: EVENT }, files.pdf());
  const res = await ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers });
  assert.equal(res.statusCode, 401);
});

test('текст, переименованный в .pdf, отклоняется по содержимому — 415', async () => {
  const res = await upload(users.alice, files.fakePdf());
  assert.equal(res.statusCode, 415);
  assert.match(res.json().message, /PDF или фото/);
});

test('HEIC без MIME-типа распознаётся по сигнатуре', async () => {
  const res = await upload(users.alice, files.heic());
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().details.fileKind, 'Фото билета');
});

test('неизвестное событие — 404', async () => {
  const res = await upload(users.alice, files.pdf(), 'no-such-event');
  assert.equal(res.statusCode, 404);
});

test('файл больше 10 МБ — 413', async () => {
  const big = { name: 'big.pdf', type: 'application/pdf', data: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(10 * 1024 * 1024)]) };
  const res = await upload(users.alice, big);
  assert.equal(res.statusCode, 413);
});

test('полный путь: проверка → объявление → видно всем → снять', async () => {
  const check = await upload(users.alice, files.pdf());
  assert.equal(check.statusCode, 201);
  const { checkId, details } = check.json();
  assert.ok(details.nominal > 0);

  // Цена выше номинала — отказ сервера, даже если интерфейс обойти
  const tooHigh = await createListing(users.alice, { checkId, price: details.nominal + 100, quantity: 1 });
  assert.equal(tooHigh.statusCode, 400);
  assert.match(tooHigh.json().message, /номинала/);

  // Попытка подсунуть свой номинал игнорируется: такого поля в API просто нет
  const sneaky = await createListing(users.alice, { checkId, price: 100, quantity: 1, nominal: 999999 });
  assert.equal(sneaky.statusCode, 400);

  const created = await createListing(users.alice, { checkId, price: details.nominal - 100, quantity: 2 });
  assert.equal(created.statusCode, 201);
  const listing = created.json().listing;
  assert.equal(listing.own, true);
  assert.equal(listing.nominal, details.nominal);
  assert.equal(listing.seller.name, 'Алиса И.');

  // Гость видит объявление, но не «своим»; Борис — тоже не своим
  const guest = (await ctx.app.inject('/api/listings')).json().listings.find((l) => l.id === listing.id);
  assert.equal(guest.own, false);
  const bobView = await ctx.app.inject({ url: '/api/listings', headers: { authorization: tma(users.bob) } });
  assert.equal(bobView.json().listings.find((l) => l.id === listing.id).own, false);

  // Повторно по той же проверке — нельзя
  const again = await createListing(users.alice, { checkId, price: 500, quantity: 1 });
  assert.equal(again.statusCode, 409);

  // Чужое объявление снять нельзя
  const bobWithdraw = await ctx.app.inject({
    method: 'POST',
    url: `/api/listings/${listing.id}/withdraw`,
    headers: { authorization: tma(users.bob) },
  });
  assert.equal(bobWithdraw.statusCode, 404);

  const withdraw = await ctx.app.inject({
    method: 'POST',
    url: `/api/listings/${listing.id}/withdraw`,
    headers: { authorization: tma(users.alice) },
  });
  assert.equal(withdraw.json().listing.status, 'withdrawn');
  assert.ok(!(await ctx.app.inject('/api/listings')).json().listings.some((l) => l.id === listing.id));

  const mine = await ctx.app.inject({ url: '/api/me/listings', headers: { authorization: tma(users.alice) } });
  assert.equal(mine.json().listings.find((l) => l.id === listing.id).status, 'withdrawn');
});

test('дубль: тот же файл не выставить дважды, после снятия — снова можно', async () => {
  const file = files.png();
  const first = await upload(users.alice, file);
  const { checkId, details } = first.json();
  const listing = (await createListing(users.alice, { checkId, price: details.nominal, quantity: 1 })).json().listing;

  const bobTry = await upload(users.bob, file);
  assert.equal(bobTry.statusCode, 409);
  assert.match(bobTry.json().message, /уже продаётся/);

  const aliceTry = await upload(users.alice, file);
  assert.equal(aliceTry.statusCode, 409);
  assert.match(aliceTry.json().message, /Вы уже продаёте/);

  await ctx.app.inject({ method: 'POST', url: `/api/listings/${listing.id}/withdraw`, headers: { authorization: tma(users.alice) } });
  assert.equal((await upload(users.bob, file)).statusCode, 201);
});

test('чужую проверку использовать нельзя — 404', async () => {
  const { checkId, details } = (await upload(users.alice, files.pdf())).json();
  const res = await createListing(users.bob, { checkId, price: details.nominal, quantity: 1 });
  assert.equal(res.statusCode, 404);
});

test('база сама не даёт записать цену выше номинала', async () => {
  const { checkId } = (await upload(users.alice, files.pdf())).json();
  const [check] = await ctx.db.query('SELECT * FROM ticket_checks WHERE id = $1', [checkId]);
  await assert.rejects(
    ctx.db.query(
      `INSERT INTO listings (seller_id, event_id, check_id, barcode, zone, title, file_kind, nominal, price, quantity)
       VALUES ($1, $2, $3, $4, $5, 't', 'pdf', $6, $7, 1)`,
      [users.alice.id, EVENT, checkId, check.barcode, check.zone, check.nominal, check.nominal + 1],
    ),
    /price_not_above_nominal/,
  );
});
