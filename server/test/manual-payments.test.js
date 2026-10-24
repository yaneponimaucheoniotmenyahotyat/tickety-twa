import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { ADMIN, files, multipart, setup, tma, users, verifyPhone } from './helpers.js';

const EVENT = 'mumiy-troll-vk';
const DETAILS = 'СБП +7 900 000-00-00, Т-Банк, Иван И.';
const mod = { id: 5001, first_name: 'Модератор' };
let ctx;

const req = (user, method, url, payload) => ctx.app.inject({ method, url, payload, headers: user ? { authorization: tma(user) } : {} });
const ledgerSum = async () => Number((await ctx.db.query(`SELECT COALESCE(sum(amount), 0) AS s FROM ledger_entries`))[0].s);
const wallet = async (user) => (await req(user, 'GET', '/api/wallet')).json().wallet;

async function listTicket(seller, price = 2000) {
  const { payload, headers } = await multipart({ eventId: EVENT }, files.pdf());
  const check = await ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers: { ...headers, authorization: tma(seller) } });
  return (await req(seller, 'POST', '/api/listings', { checkId: check.json().checkId, zone: 'dance', price, quantity: 1 })).json().listing;
}

before(async () => {
  ctx = await setup({ payments: 'manual', paymentDetails: DETAILS });
  await verifyPhone(ctx.app, users.alice);
  await req(mod, 'GET', '/api/me');
  await req(ADMIN, 'POST', '/api/admin/staff', { userId: mod.id, role: 'moderator' });
});
after(() => ctx.close());

test('без реквизитов ручной режим не запускается', () => {
  assert.throws(() => loadConfig({ PAYMENTS_MODE: 'manual' }), /PAYMENT_DETAILS/);
  assert.equal(loadConfig({ PAYMENTS_MODE: 'manual', PAYMENT_DETAILS: 'x' }).paymentsMode, 'manual');
});

test('ручной перевод: бронь → реквизиты → «Я перевёл» → владелец подтверждает → удержание', async () => {
  const listing = await listTicket(users.alice, 2700);
  assert.equal((await ctx.app.inject('/api/config')).json().payments, 'manual');

  const order = (await req(users.bob, 'POST', '/api/orders', { listingId: listing.id })).json().order;
  assert.equal(order.payment.details, DETAILS, 'реквизиты — только после брони');
  assert.match(order.payment.code, /^TK-[2-9A-F]{6}$/);
  assert.equal(order.payment.amount, 2700);
  // Продавцу реквизиты владельца не показываются
  assert.equal((await req(users.alice, 'GET', `/api/orders/${order.id}`)).json().order.payment, undefined);
  // Тестовая оплата в ручном режиме выключена
  assert.equal((await req(users.bob, 'POST', `/api/orders/${order.id}/pay`, { method: 'test' })).statusCode, 400);

  ctx.sent.length = 0;
  const reported = (await req(users.bob, 'POST', `/api/orders/${order.id}/report-paid`)).json().order;
  assert.ok(reported.buyerReportedAt);
  assert.ok(ctx.sent.some((s) => s.chatId === ADMIN.id && s.text.includes(order.payment.code)), 'владельцу — код перевода');
  assert.ok(!ctx.sent.some((s) => s.chatId === mod.id), 'модератору о деньгах не пишем');

  // После «Я перевёл» бронь не сгорает и сам покупатель её не отменит
  await ctx.db.query(`UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1`, [order.id]);
  assert.equal((await req(users.bob, 'POST', `/api/orders/${order.id}/cancel`)).statusCode, 409);
  const queue = (await req(ADMIN, 'GET', '/api/admin/orders?status=awaiting')).json().orders;
  assert.ok(queue.some((o) => o.id === order.id));

  // Подтвердить поступление может только владелец, не модератор
  assert.equal((await req(mod, 'POST', `/api/admin/orders/${order.id}/confirm-payment`)).statusCode, 403);
  const confirmed = await req(ADMIN, 'POST', `/api/admin/orders/${order.id}/confirm-payment`);
  assert.equal(confirmed.json().order.status, 'paid');
  assert.equal(confirmed.json().order.provider, 'manual');
  assert.equal((await req(ADMIN, 'POST', `/api/admin/orders/${order.id}/confirm-payment`)).statusCode, 409, 'дважды не подтвердить');

  assert.equal((await wallet(users.alice)).held, 2700);
  assert.equal((await req(users.bob, 'POST', `/api/orders/${order.id}/ticket-link`)).statusCode, 200);
  assert.equal(await ledgerSum(), 0);
});

test('перевод не пришёл — бронь снимается, билет снова в продаже', async () => {
  const listing = await listTicket(users.alice, 1500);
  const order = (await req(users.bob, 'POST', '/api/orders', { listingId: listing.id })).json().order;
  await req(users.bob, 'POST', `/api/orders/${order.id}/report-paid`);
  ctx.sent.length = 0;
  const rejected = await req(ADMIN, 'POST', `/api/admin/orders/${order.id}/reject-payment`, { reason: 'Поступления нет' });
  assert.equal(rejected.statusCode, 200);
  assert.ok(ctx.sent.some((s) => s.chatId === users.bob.id && /не найден/.test(s.text)));
  assert.ok((await ctx.app.inject('/api/listings')).json().listings.some((l) => l.id === listing.id));
});

test('выплата: заявка на подтверждённый номер → владелец переводит и отмечает; отказ возвращает деньги', async () => {
  // Завершённая продажа: деньги в кошельке
  const listing = await listTicket(users.alice, 3000);
  const order = (await req(users.bob, 'POST', '/api/orders', { listingId: listing.id })).json().order;
  await req(users.bob, 'POST', `/api/orders/${order.id}/report-paid`);
  await req(ADMIN, 'POST', `/api/admin/orders/${order.id}/confirm-payment`);
  await req(users.bob, 'POST', `/api/orders/${order.id}/confirm`);
  const before = await wallet(users.alice);
  assert.ok(before.available >= 3000);

  assert.equal((await req(users.alice, 'POST', '/api/wallet/payouts', { amount: 1000 })).statusCode, 400, 'нужен банк');
  // Без подтверждённого номера вывода нет
  assert.equal((await req(users.bob, 'POST', '/api/wallet/payouts', { amount: 100, bank: 'Сбер' })).statusCode, 403);

  ctx.sent.length = 0;
  let w = (await req(users.alice, 'POST', '/api/wallet/payouts', { amount: 1000, bank: 'Т-Банк' })).json().wallet;
  assert.equal(w.available, before.available - 1000);
  assert.equal(w.pendingPayout, 1000);
  assert.match(w.payouts[0].details, /^СБП \+79991234567 • Т-Банк$/, 'только на свой подтверждённый номер');
  assert.ok(ctx.sent.some((s) => s.chatId === ADMIN.id && /Заявка на выплату/.test(s.text)));

  const requested = (await req(ADMIN, 'GET', '/api/admin/payouts')).json().payouts;
  const payout = requested.find((p) => p.seller.id === users.alice.id);
  assert.equal((await req(mod, 'POST', `/api/admin/payouts/${payout.id}/paid`)).statusCode, 403);
  assert.equal((await req(ADMIN, 'POST', `/api/admin/payouts/${payout.id}/paid`)).json().payout.status, 'paid');
  assert.equal((await req(ADMIN, 'POST', `/api/admin/payouts/${payout.id}/paid`)).statusCode, 409);
  w = await wallet(users.alice);
  assert.deepEqual([w.pendingPayout, w.paidOut], [0, 1000]);

  // Отклонённая заявка — деньги снова доступны
  await req(users.alice, 'POST', '/api/wallet/payouts', { amount: 500, bank: 'Сбер' });
  const second = (await req(ADMIN, 'GET', '/api/admin/payouts')).json().payouts.find((p) => p.amount === 500);
  await req(ADMIN, 'POST', `/api/admin/payouts/${second.id}/reject`, { reason: 'Неверный банк' });
  w = await wallet(users.alice);
  assert.equal(w.available, before.available - 1000);
  assert.equal(w.pendingPayout, 0);
  assert.equal(await ledgerSum(), 0);
});
