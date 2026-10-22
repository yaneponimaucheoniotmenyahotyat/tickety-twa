import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { files, multipart, setup, signedContact, tma, verifyPhone } from './helpers.js';

let ctx;
before(async () => {
  ctx = await setup();
});
after(() => ctx.close());

const carol = { id: 2001, first_name: 'Карина' };
const dan = { id: 2002, first_name: 'Даниил' };
const eve = { id: 2003, first_name: 'Ева' };

const upload = (user) => {
  const { payload, headers } = multipart({ eventId: 'mumiy-troll-vk' }, files.pdf());
  return ctx.app.inject({ method: 'POST', url: '/api/ticket-checks', payload, headers: { ...headers, authorization: tma(user) } });
};

test('без подтверждённого номера продавать нельзя — 403 до загрузки файла', async () => {
  const res = await upload(carol);
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, 'phone_required');
  const [{ count }] = await ctx.db.query('SELECT count(*)::int AS count FROM ticket_checks');
  assert.equal(count, 0, 'файл не должен был обрабатываться');
});

test('подписанный номер подтверждается, наружу — только маска', async () => {
  const res = await verifyPhone(ctx.app, carol, signedContact(carol, '7 999 123-45-67'));
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().user.phoneVerified, true);
  assert.equal(res.json().user.phoneMasked, '+7 ••• •••-45-67');
  assert.ok(!JSON.stringify(res.json()).includes('9991234567'), 'полный номер не отдаётся');

  const me = await ctx.app.inject({ url: '/api/me', headers: { authorization: tma(carol) } });
  assert.equal(me.json().user.phoneVerified, true);

  const [log] = await ctx.db.query(`SELECT method, subject FROM identity_verifications WHERE user_id = $1`, [carol.id]);
  assert.deepEqual(log, { method: 'telegram_phone', subject: '+79991234567' });
});

test('чужой контакт — 400, подделка — 401, старый ответ — 401', async () => {
  const foreign = await verifyPhone(ctx.app, dan, signedContact(carol));
  assert.equal(foreign.statusCode, 400);
  assert.equal(foreign.json().error, 'foreign_contact');

  const forged = signedContact(dan).replace('79991234567', '70000000000');
  assert.equal((await verifyPhone(ctx.app, dan, forged)).statusCode, 401);

  const stale = signedContact(dan, '79990000000', Math.floor(Date.now() / 1000) - 3600);
  assert.equal((await verifyPhone(ctx.app, dan, stale)).statusCode, 401);

  const me = await ctx.app.inject({ url: '/api/me', headers: { authorization: tma(dan) } });
  assert.equal(me.json().user.phoneVerified, false);
});

test('новый продавец — не больше 3 активных объявлений, после первой продажи — больше', async () => {
  await verifyPhone(ctx.app, eve);
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const { checkId } = (await upload(eve)).json();
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/listings',
      payload: { checkId, zone: 'dance', price: 1000, quantity: 1 },
      headers: { authorization: tma(eve) },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().listing.seller.phoneVerified, true);
    ids.push(res.json().listing.id);
  }

  const fourth = await upload(eve);
  assert.equal(fourth.statusCode, 403);
  assert.equal(fourth.json().error, 'new_seller_limit');

  // Первая завершённая продажа (появится на шаге «покупки») снимает лимит
  await ctx.db.query(`UPDATE listings SET status = 'sold' WHERE id = $1`, [ids[0]]);
  assert.equal((await upload(eve)).statusCode, 201);
});
