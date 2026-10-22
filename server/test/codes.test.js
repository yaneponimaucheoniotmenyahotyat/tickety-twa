import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { files, multipart, setup, ticketCode, tma, users, verifyPhone } from './helpers.js';

const EVENT = 'mumiy-troll-vk';
let ctx;

before(async () => {
  ctx = await setup();
  await verifyPhone(ctx.app, users.alice);
  await verifyPhone(ctx.app, users.bob);
});
after(() => ctx.close());

async function upload(user, file) {
  const { payload, headers } = await multipart({ eventId: EVENT }, file);
  return ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers: { ...headers, authorization: tma(user) } });
}
const list = (user, body) =>
  ctx.app.inject({ method: 'POST', url: '/api/listings', payload: { zone: 'dance', price: 1000, quantity: 1, ...body }, headers: { authorization: tma(user) } });
const withdraw = (user, id) =>
  ctx.app.inject({ method: 'POST', url: `/api/listings/${id}/withdraw`, headers: { authorization: tma(user) } });

test('обычная картинка без кода — не билет (422)', async () => {
  const res = await upload(users.alice, files.picture());
  assert.equal(res.statusCode, 422);
  assert.equal(res.json().error, 'no_code');
  assert.match(res.json().message, /QR-код или штрихкод/);
  const [{ n }] = await ctx.db.query('SELECT count(*)::int AS n FROM ticket_checks');
  assert.equal(n, 0, 'проверка без кода не сохраняется');
});

test('код находится и на фото, и в PDF; линейный штрихкод тоже подходит', async () => {
  assert.equal((await upload(users.alice, files.png())).json().code, 'QR-код');
  assert.equal((await upload(users.alice, files.pdf())).json().code, 'QR-код');
  assert.equal((await upload(users.alice, files.png(ticketCode(), 'Code128'))).json().code, 'штрихкод');
  assert.equal((await upload(users.alice, files.png(ticketCode(), 'Aztec'))).json().code, 'Aztec-код');
});

test('тот же билет другим файлом (скриншот вместо PDF) второй раз не выставить', async () => {
  const code = ticketCode();
  const first = await upload(users.alice, files.pdf(code));
  const listing = (await list(users.alice, { checkId: first.json().checkId })).json().listing;
  assert.match(listing.details, /есть QR-код/);

  const screenshot = await upload(users.bob, files.png(code));
  assert.equal(screenshot.statusCode, 409);
  assert.match(screenshot.json().message, /уже продаётся/);

  // Сняли с продажи — код освободился
  await withdraw(users.alice, listing.id);
  assert.equal((await upload(users.bob, files.png(code))).statusCode, 201);
});

test('гонка: два файла с одним кодом проверены до публикации — второе объявление не пройдёт', async () => {
  const code = ticketCode();
  const a = (await upload(users.alice, files.pdf(code))).json();
  const b = (await upload(users.bob, files.png(code))).json();
  assert.equal((await list(users.alice, { checkId: a.checkId })).statusCode, 201);
  const second = await list(users.bob, { checkId: b.checkId });
  assert.equal(second.statusCode, 409);
  const [{ n }] = await ctx.db.query(`SELECT count(*)::int AS n FROM listings WHERE seller_id = $1 AND status = 'active' AND check_id = $2`, [users.bob.id, b.checkId]);
  assert.equal(n, 0, 'объявление без кодов не должно остаться');
});

test('количество не больше числа кодов в файле', async () => {
  const one = (await upload(users.bob, files.png())).json();
  const tooMany = await list(users.bob, { checkId: one.checkId, quantity: 2 });
  assert.equal(tooMany.statusCode, 400);
  assert.equal(tooMany.json().error, 'quantity_over_codes');

  const two = (await upload(users.bob, files.pdf(ticketCode(), ticketCode()))).json();
  assert.equal(two.codes, 2);
  assert.equal((await list(users.bob, { checkId: two.checkId, quantity: 2 })).statusCode, 201);
});
