import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { releaseDue } from '../src/orders.js';
import { ADMIN, files, multipart, setup, tma, users, verifyPhone } from './helpers.js';

const EVENT = 'mumiy-troll-vk';
const carol = { id: 4001, first_name: 'Карина' };
let ctx;
let dir;

const req = (user, method, url, payload) => ctx.app.inject({ method, url, payload, headers: user ? { authorization: tma(user) } : {} });

async function listTicket(seller, price = 2000, quantity = 1) {
  const { payload, headers } = await multipart({ eventId: EVENT }, quantity > 1 ? files.pdf('A' + Math.random(), 'B' + Math.random()) : files.pdf());
  const check = await ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers: { ...headers, authorization: tma(seller) } });
  return (await req(seller, 'POST', '/api/listings', { checkId: check.json().checkId, zone: 'dance', price, quantity })).json().listing;
}

const buy = async (buyer, listingId) => {
  const reserved = await req(buyer, 'POST', '/api/orders', { listingId });
  assert.equal(reserved.statusCode, 201, reserved.body);
  const paid = await req(buyer, 'POST', `/api/orders/${reserved.json().order.id}/pay`, { method: 'test' });
  assert.equal(paid.statusCode, 200, paid.body);
  return paid.json().order;
};

const wallet = async (user) => (await req(user, 'GET', '/api/wallet')).json().wallet;

// Сумма всех проводок — всегда ноль: деньги не появляются и не исчезают
const ledgerSum = async () => Number((await ctx.db.query(`SELECT COALESCE(sum(amount), 0) AS s FROM ledger_entries`))[0].s);

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tickety-orders-'));
  ctx = await setup({ uploadDir: dir });
  await verifyPhone(ctx.app, users.alice);
  await verifyPhone(ctx.app, carol);
});
after(async () => {
  await ctx.close();
  await rm(dir, { recursive: true, force: true });
});

test('полный путь: бронь → оплата → удержание → подтверждение прохода → кошелёк → вывод', async () => {
  const listing = await listTicket(users.alice, 2500, 2);
  ctx.sent.length = 0;

  const reserved = await req(users.bob, 'POST', '/api/orders', { listingId: listing.id });
  assert.equal(reserved.statusCode, 201);
  const order = reserved.json().order;
  assert.equal(order.status, 'pending');
  assert.equal(order.amount, 5000, '2 билета × 2 500 ₽');
  // Забронированный билет пропал с витрины
  assert.ok(!(await ctx.app.inject('/api/listings')).json().listings.some((l) => l.id === listing.id));
  // Второй покупатель его не забронирует
  assert.equal((await req(carol, 'POST', '/api/orders', { listingId: listing.id })).statusCode, 409);

  const paid = (await req(users.bob, 'POST', `/api/orders/${order.id}/pay`, { method: 'test' })).json().order;
  assert.equal(paid.status, 'paid');
  assert.ok(new Date(paid.holdUntil) > new Date(paid.event.date), 'деньги держим до суток после начала');
  assert.ok(ctx.sent.some((s) => s.chatId === users.alice.id && /купили/.test(s.text)), 'продавцу пришло уведомление');

  let w = await wallet(users.alice);
  assert.deepEqual([w.held, w.available, w.paidOut], [5000, 0, 0]);
  const mine = (await req(users.alice, 'GET', '/api/me/listings')).json().listings.find((l) => l.id === listing.id);
  assert.equal(mine.status, 'sold');
  assert.equal(mine.sale.status, 'paid');

  // Чужой заказ не подтвердить
  assert.equal((await req(carol, 'POST', `/api/orders/${order.id}/confirm`)).statusCode, 404);
  assert.equal((await req(users.bob, 'POST', `/api/orders/${order.id}/confirm`)).json().order.status, 'completed');

  w = await wallet(users.alice);
  assert.deepEqual([w.held, w.available], [0, 5000]);

  assert.equal((await req(users.alice, 'POST', '/api/wallet/payouts', { amount: 6000 })).statusCode, 400, 'больше доступного не вывести');
  w = (await req(users.alice, 'POST', '/api/wallet/payouts', { amount: 3000 })).json().wallet;
  assert.deepEqual([w.available, w.paidOut], [2000, 3000]);
  assert.equal(await ledgerSum(), 0);
});

test('бронь: свой билет не купить, повторное «Купить» возвращает ту же бронь, отмена возвращает на витрину', async () => {
  const listing = await listTicket(users.alice);
  assert.equal((await req(users.alice, 'POST', '/api/orders', { listingId: listing.id })).statusCode, 400);

  const first = (await req(users.bob, 'POST', '/api/orders', { listingId: listing.id })).json().order;
  const again = await req(users.bob, 'POST', '/api/orders', { listingId: listing.id });
  assert.equal(again.json().order.id, first.id);

  assert.equal((await req(users.bob, 'POST', `/api/orders/${first.id}/cancel`)).json().order.status, 'cancelled');
  assert.ok((await ctx.app.inject('/api/listings')).json().listings.some((l) => l.id === listing.id));
});

test('истёкшая бронь: оплатить нельзя, билет снова в продаже', async () => {
  const listing = await listTicket(users.alice);
  const order = (await req(users.bob, 'POST', '/api/orders', { listingId: listing.id })).json().order;
  await ctx.db.query(`UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1`, [order.id]);

  const late = await req(users.bob, 'POST', `/api/orders/${order.id}/pay`, { method: 'test' });
  assert.equal(late.statusCode, 410);
  assert.ok((await ctx.app.inject('/api/listings')).json().listings.some((l) => l.id === listing.id));
  // Другой покупатель может купить
  await buy(carol, listing.id);
});

test('без спора деньги уходят продавцу сами, когда срок удержания истёк', async () => {
  const listing = await listTicket(users.alice, 1500);
  const order = await buy(users.bob, listing.id);
  const before = (await wallet(users.alice)).available;

  await ctx.db.query(`UPDATE orders SET hold_until = now() - interval '1 minute' WHERE id = $1`, [order.id]);
  assert.ok((await releaseDue(ctx.db, ctx.app.notify)) >= 1);
  const after = await wallet(users.alice);
  assert.equal(after.available - before, 1500);
  assert.equal((await req(users.bob, 'GET', `/api/orders/${order.id}`)).json().order.status, 'completed');
  assert.equal(await ledgerSum(), 0);
});

test('спор: деньги замораживаются; команда возвращает их покупателю, объявление снимается', async () => {
  const listing = await listTicket(users.alice, 1800);
  const order = await buy(users.bob, listing.id);
  const heldBefore = (await wallet(users.alice)).held;
  ctx.sent.length = 0;

  const disputed = await req(users.bob, 'POST', `/api/orders/${order.id}/dispute`, { reason: 'QR-код не прошёл на входе' });
  assert.equal(disputed.json().order.status, 'disputed');
  assert.ok(ctx.sent.some((s) => s.chatId === ADMIN.id && /Спор/.test(s.text)), 'команде пришло уведомление');
  assert.ok(ctx.sent.some((s) => s.chatId === users.alice.id), 'продавца предупредили');

  // Срок вышел, но спор открыт — автоматически продавцу не уходит
  await ctx.db.query(`UPDATE orders SET hold_until = now() - interval '1 minute' WHERE id = $1`, [order.id]);
  await releaseDue(ctx.db, ctx.app.notify);
  assert.equal((await wallet(users.alice)).held, heldBefore);

  // Покупатель после спора уже не может «подтвердить проход»
  assert.equal((await req(users.bob, 'POST', `/api/orders/${order.id}/confirm`)).statusCode, 409);

  assert.equal((await req(users.bob, 'POST', `/api/admin/orders/${order.id}/refund`, { reason: 'Тест' })).statusCode, 403);
  const queue = (await req(ADMIN, 'GET', '/api/admin/orders?status=disputed')).json().orders;
  assert.ok(queue.some((o) => o.id === order.id && o.disputeReason));

  const refunded = await req(ADMIN, 'POST', `/api/admin/orders/${order.id}/refund`, { reason: 'Билет не сработал' });
  assert.equal(refunded.json().order.status, 'refunded');
  assert.equal((await wallet(users.alice)).held, heldBefore - 1800);
  const sellerView = (await req(users.alice, 'GET', '/api/me/listings')).json().listings.find((l) => l.id === listing.id);
  assert.equal(sellerView.status, 'removed');
  assert.match(sellerView.removedReason, /деньги возвращены/);

  // Повторно вернуть нельзя
  assert.equal((await req(ADMIN, 'POST', `/api/admin/orders/${order.id}/refund`, { reason: 'Ещё раз' })).statusCode, 409);
  assert.equal(await ledgerSum(), 0);
});

test('спор решён в пользу продавца — деньги в кошелёк', async () => {
  const listing = await listTicket(users.alice, 1200);
  const order = await buy(users.bob, listing.id);
  await req(users.bob, 'POST', `/api/orders/${order.id}/dispute`, { reason: 'Не уверен в билете' });
  const before = (await wallet(users.alice)).available;
  const released = await req(ADMIN, 'POST', `/api/admin/orders/${order.id}/release`, { reason: 'Проход подтверждён организатором' });
  assert.equal(released.json().order.status, 'completed');
  assert.equal((await wallet(users.alice)).available - before, 1200);
});

test('проданный билет нельзя выставить снова — ни тем же, ни другим продавцом', async () => {
  const file = files.pdf();
  const { payload, headers } = await multipart({ eventId: EVENT }, file);
  const check = await ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers: { ...headers, authorization: tma(users.alice) } });
  const listing = (await req(users.alice, 'POST', '/api/listings', { checkId: check.json().checkId, zone: 'dance', price: 900, quantity: 1 })).json().listing;
  await buy(users.bob, listing.id);

  for (const seller of [users.alice, carol]) {
    const again = await multipart({ eventId: EVENT }, file);
    const res = await ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload: again.payload, headers: { ...again.headers, authorization: tma(seller) } });
    assert.equal(res.statusCode, 409);
  }
});

test('файл билета — только покупателю после оплаты, по подписанной ссылке', async () => {
  const listing = await listTicket(users.alice, 1000);
  const reserved = (await req(users.bob, 'POST', '/api/orders', { listingId: listing.id })).json().order;
  assert.equal((await req(users.bob, 'POST', `/api/orders/${reserved.id}/ticket-link`)).statusCode, 403, 'до оплаты — нет');
  await req(users.bob, 'POST', `/api/orders/${reserved.id}/pay`, { method: 'test' });

  assert.equal((await req(carol, 'POST', `/api/orders/${reserved.id}/ticket-link`)).statusCode, 404, 'чужой — нет');
  const { url } = (await req(users.bob, 'POST', `/api/orders/${reserved.id}/ticket-link`)).json();
  const file = await ctx.app.inject(url);
  assert.equal(file.statusCode, 200);
  assert.equal(file.headers['content-type'], 'application/pdf');
  assert.equal(file.rawPayload.subarray(0, 5).toString(), '%PDF-');

  const forged = url.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
  assert.equal((await ctx.app.inject(forged)).statusCode, 403);
});

test('оплата выключена (PAYMENTS_MODE=off) — купить нельзя', async () => {
  const off = await setup({ payments: 'off' });
  try {
    assert.deepEqual((await off.app.inject('/api/config')).json(), { payments: 'off' });
    const res = await off.app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: { listingId: '00000000-0000-4000-8000-000000000000' },
      headers: { authorization: tma(users.bob) },
    });
    assert.equal(res.statusCode, 503);
  } finally {
    await off.close();
  }
});
