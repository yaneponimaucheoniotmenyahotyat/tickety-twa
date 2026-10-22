import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN, files, multipart, setup, tma, users, verifyPhone } from './helpers.js';

const EVENT = 'mumiy-troll-vk';
const mod = { id: 3001, first_name: 'Мария', last_name: 'Модератова', username: 'masha_mod' };
const agent = { id: 3002, first_name: 'Сергей' };
let ctx;

const req = (user, method, url, payload) => ctx.app.inject({ method, url, payload, headers: user ? { authorization: tma(user) } : {} });
const me = async (user) => (await req(user, 'GET', '/api/me')).json().user;

async function sell(user) {
  const { payload, headers } = await multipart({ eventId: EVENT }, files.pdf());
  const check = await ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers: { ...headers, authorization: tma(user) } });
  return (await req(user, 'POST', '/api/listings', { checkId: check.json().checkId, zone: 'dance', price: 1000, quantity: 1 })).json().listing;
}

before(async () => {
  ctx = await setup();
  await verifyPhone(ctx.app, users.alice);
  // Роль можно дать только тому, кто уже открывал приложение
  for (const u of [mod, agent, users.bob, ADMIN]) await me(u);
});
after(() => ctx.close());

test('команда: роли выдаёт только владелец, и только знакомым Tickety людям', async () => {
  assert.equal((await req(users.alice, 'POST', '/api/admin/staff', { userId: mod.id, role: 'moderator' })).statusCode, 403);
  assert.equal((await req(ADMIN, 'POST', '/api/admin/staff', { userId: 555555, role: 'moderator' })).statusCode, 404);
  assert.equal((await req(ADMIN, 'POST', '/api/admin/staff', { userId: mod.id, role: 'owner' })).statusCode, 400, 'владельца через API не назначить');

  assert.equal((await req(ADMIN, 'POST', '/api/admin/staff', { userId: mod.id, role: 'moderator' })).statusCode, 200);
  assert.equal((await req(ADMIN, 'POST', '/api/admin/staff', { userId: agent.id, role: 'support' })).statusCode, 200);

  const team = (await req(ADMIN, 'GET', '/api/admin/staff')).json().staff;
  assert.deepEqual(team.find((s) => s.id === mod.id).roles, ['moderator']);
  assert.equal(team.find((s) => s.id === ADMIN.id).owner, true);

  // Модератор не управляет командой
  assert.equal((await req(mod, 'GET', '/api/admin/staff')).statusCode, 403);
});

test('права по ролям: модератор — события и объявления, поддержка — только обращения', async () => {
  const m = await me(mod);
  assert.deepEqual(m.staff.permissions.sort(), ['events', 'moderation']);
  assert.equal(m.isAdmin, true);
  assert.equal((await req(mod, 'GET', '/api/admin/events')).statusCode, 200);
  assert.equal((await req(mod, 'GET', '/api/admin/listings')).statusCode, 200);

  assert.deepEqual((await me(agent)).staff.permissions, ['support']);
  assert.equal((await req(agent, 'GET', '/api/admin/events')).statusCode, 403);
  assert.equal((await req(agent, 'GET', '/api/admin/listings')).statusCode, 403);
  assert.equal((await req(agent, 'GET', '/api/admin/support')).statusCode, 200);

  assert.equal((await me(users.bob)).isAdmin, false);
  assert.equal((await req(users.bob, 'GET', '/api/admin/support')).statusCode, 403);
});

test('снятая роль действует сразу; участника команды нельзя заблокировать', async () => {
  assert.equal((await req(mod, 'POST', `/api/admin/users/${agent.id}/block`, { reason: 'Проверка' })).statusCode, 403);

  await req(ADMIN, 'POST', '/api/admin/staff', { userId: users.bob.id, role: 'moderator' });
  assert.equal((await req(users.bob, 'GET', '/api/admin/listings')).statusCode, 200);
  assert.equal((await req(ADMIN, 'DELETE', `/api/admin/staff/${users.bob.id}/moderator`)).statusCode, 200);
  assert.equal((await req(users.bob, 'GET', '/api/admin/listings')).statusCode, 403);
});

test('событие: снять с витрины вместе с объявлениями, вернуть, удалить только без истории', async () => {
  const listing = await sell(users.alice);
  const withdrawn = await req(mod, 'POST', `/api/admin/events/${EVENT}/withdraw`, { reason: 'Концерт перенесён' });
  assert.equal(withdrawn.statusCode, 200);
  assert.equal(withdrawn.json().event.status, 'hidden');
  assert.ok(withdrawn.json().removedListings >= 1);
  assert.ok(!(await ctx.app.inject('/api/events')).json().events.some((e) => e.id === EVENT));
  const mine = (await req(users.alice, 'GET', '/api/me/listings')).json().listings.find((l) => l.id === listing.id);
  assert.equal(mine.status, 'removed');
  assert.match(mine.removedReason, /Концерт перенесён/);

  assert.equal((await req(mod, 'POST', `/api/admin/events/${EVENT}/publish`)).json().event.status, 'published');
  assert.equal((await req(mod, 'DELETE', `/api/admin/events/${EVENT}`)).statusCode, 409, 'с историей объявлений не удаляется');

  const draft = await req(mod, 'POST', '/api/admin/events', {
    title: 'Создано по ошибке',
    category: 'concert',
    date: '2027-05-01T19:00:00+03:00',
    venue: 'Где-то',
    city: 'Москва',
    cover: ['#1B2F5D', '#3D7BFF', '#F47C20'],
    status: 'hidden',
    zones: [{ label: 'Зал', nominal: 1000, seating: 'seats' }],
  });
  const id = draft.json().event.id;
  assert.equal((await req(agent, 'DELETE', `/api/admin/events/${id}`)).statusCode, 403);
  assert.equal((await req(mod, 'DELETE', `/api/admin/events/${id}`)).statusCode, 200);
  assert.ok(!(await req(mod, 'GET', '/api/admin/events')).json().events.some((e) => e.id === id));
});

test('поддержка: обращение → уведомление команде → ответ → уведомление пользователю', async () => {
  ctx.sent.length = 0;
  const created = await req(users.bob, 'POST', '/api/support/threads', { category: 'buying', body: 'Как купить билет?' });
  assert.equal(created.statusCode, 201);
  const { thread } = created.json();
  assert.equal(thread.status, 'open');

  // Команде: владельцу и поддержке, но не модератору (это не жалоба)
  const alerted = ctx.sent.map((s) => s.chatId).sort();
  assert.deepEqual(alerted, [agent.id, ADMIN.id].sort());
  assert.match(ctx.sent[0].text, /Как купить билет/);

  // Чужое обращение не открыть
  assert.equal((await req(users.alice, 'GET', `/api/support/threads/${thread.id}`)).statusCode, 404);
  // Модератор без роли поддержки обычные обращения не видит
  assert.equal((await req(mod, 'GET', `/api/admin/support/${thread.id}`)).statusCode, 404);

  ctx.sent.length = 0;
  const answer = await req(agent, 'POST', `/api/admin/support/${thread.id}/messages`, { body: 'Оплата появится после беты.' });
  assert.equal(answer.statusCode, 200);
  assert.equal(answer.json().thread.status, 'answered');
  assert.deepEqual(ctx.sent.map((s) => s.chatId), [users.bob.id]);
  assert.match(ctx.sent[0].text, /Поддержка Tickety ответила/);

  // Пользователь видит ответ от «команды», без имени сотрудника
  const view = (await req(users.bob, 'GET', `/api/support/threads/${thread.id}`)).json();
  assert.deepEqual(view.messages.map((m) => m.author), ['user', 'staff']);
  assert.ok(!JSON.stringify(view).includes('Сергей'));

  // Ответ пользователя снова ставит обращение в очередь; закрытое — переоткрывается
  await req(agent, 'POST', `/api/admin/support/${thread.id}/close`);
  const again = await req(users.bob, 'POST', `/api/support/threads/${thread.id}/messages`, { body: 'Спасибо, а когда?' });
  assert.equal(again.json().thread.status, 'open');
  assert.ok((await req(agent, 'GET', '/api/admin/support?status=open')).json().threads.some((t) => t.id === thread.id));
});

test('жалоба на объявление: видна модератору, на своё — нельзя', async () => {
  const listing = await sell(users.alice);
  assert.equal(
    (await req(users.alice, 'POST', '/api/support/threads', { category: 'complaint', body: 'Сам на себя', listingId: listing.id })).statusCode,
    400,
  );
  assert.equal((await req(users.bob, 'POST', '/api/support/threads', { category: 'complaint', body: 'Без объявления' })).statusCode, 400);

  ctx.sent.length = 0;
  const complaint = await req(users.bob, 'POST', '/api/support/threads', {
    category: 'complaint',
    body: 'Продавец просит перевести деньги на карту',
    listingId: listing.id,
  });
  assert.equal(complaint.statusCode, 201);
  assert.ok(ctx.sent.some((s) => s.chatId === mod.id), 'жалобы получают и модераторы');

  const view = (await req(mod, 'GET', `/api/admin/support/${complaint.json().thread.id}`)).json();
  assert.equal(view.listing.id, listing.id);
  assert.equal(view.listing.sellerId, users.alice.id);
});

test('не больше 3 незакрытых обращений; пустые и слишком короткие — нет', async () => {
  assert.equal((await req(users.bob, 'POST', '/api/support/threads', { category: 'question', body: 'ну' })).statusCode, 400);
  const sentBefore = (await req(users.bob, 'GET', '/api/support/threads')).json().threads.filter((t) => t.status !== 'closed').length;
  for (let i = sentBefore; i < 3; i++) {
    assert.equal((await req(users.bob, 'POST', '/api/support/threads', { category: 'question', body: `Вопрос номер ${i}` })).statusCode, 201);
  }
  assert.equal((await req(users.bob, 'POST', '/api/support/threads', { category: 'question', body: 'Ещё один вопрос' })).statusCode, 429);
});
