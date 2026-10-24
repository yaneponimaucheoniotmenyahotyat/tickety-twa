// Покупка билета с удержанием денег (эскроу) и кошелёк продавца.
//
//   бронь (pending, 15 мин) → оплата (paid: деньги удерживаются до hold_until — сутки после начала)
//     → покупатель подтвердил проход или срок вышел без спора → completed: деньги продавцу
//     → спор (disputed) → команда решает: вернуть покупателю (refunded) или отдать продавцу
//
// Каждое движение денег — проводки в ledger_entries с общим tx_id и нулевой суммой.
// Провайдеры (PAYMENTS_MODE):
//   test   — тестовые деньги, оплата мгновенная;
//   manual — покупатель переводит владельцу по PAYMENT_DETAILS и жмёт «Я перевёл», владелец
//            подтверждает поступление в админке и сам переводит выплаты продавцам;
// Настоящий провайдер (ЮKassa / Т-Банк «Безопасная сделка») встанет на место markPaid.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError } from './errors.js';
import { excerpt } from './notify.js';
import { staffWith } from './staff.js';

export const RESERVATION_MINUTES = 15;
const MANUAL_RESERVATION_MINUTES = 30; // на перевод из приложения банка нужно больше времени
export const HOLD_HOURS_AFTER_START = 24;
const FEE_PERCENT = 0; // бета: без комиссии
const MAX_PENDING_PER_BUYER = 2; // нельзя забронировать полвитрины
const LINK_TTL_SEC = 10 * 60;

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const idParams = { type: 'object', properties: { id: { type: 'string', pattern: UUID } } };
const reasonBody = {
  type: 'object',
  additionalProperties: false,
  required: ['reason'],
  properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } },
};
const isUniqueViolation = (err) => err?.code === '23505';

const rub = (n) => `${new Intl.NumberFormat('ru-RU').format(n)} ₽`;
const dateRu = (d) =>
  new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

// Проводки одной операции: сумма обязана быть нулём — деньги не появляются из ниоткуда
async function post(t, entries) {
  const sum = entries.reduce((s, e) => s + e.amount, 0);
  if (sum !== 0) throw new Error(`несбалансированная проводка: ${sum}`);
  const txId = randomUUID();
  for (const e of entries) {
    await t.query(
      `INSERT INTO ledger_entries (tx_id, order_id, payout_id, user_id, account, amount) VALUES ($1, $2, $3, $4, $5, $6)`,
      [txId, e.orderId ?? null, e.payoutId ?? null, e.userId ?? null, e.account, e.amount],
    );
  }
}

const ORDER_SELECT = `
  SELECT o.*, l.title AS listing_title, l.zone, l.file_kind, l.file_sha256,
         e.title AS event_title, e.starts_at, e.venue, e.city, e.address, e.doors_open, e.cover, e.image,
         s.first_name AS seller_first_name, s.last_name AS seller_last_name, s.username AS seller_username,
         b.first_name AS buyer_first_name, b.last_name AS buyer_last_name, b.username AS buyer_username,
         b.phone AS buyer_phone, b.phone_verified_at AS buyer_phone_verified_at
  FROM orders o
  JOIN listings l ON l.id = o.listing_id
  LEFT JOIN events e ON e.id = o.event_id
  JOIN users s ON s.id = o.seller_id
  JOIN users b ON b.id = o.buyer_id`;

const shortName = (first, last) => [first, last ? `${last[0]}.` : null].filter(Boolean).join(' ');

export function toOrder(row, viewerId) {
  const role = Number(row.buyer_id) === Number(viewerId) ? 'buyer' : Number(row.seller_id) === Number(viewerId) ? 'seller' : null;
  return {
    id: row.id,
    role,
    status: row.status,
    listingId: row.listing_id,
    title: row.listing_title,
    fileKind: row.file_kind,
    quantity: row.quantity,
    price: row.price,
    amount: row.amount,
    fee: row.fee,
    sellerAmount: row.amount - row.fee,
    provider: row.provider,
    expiresAt: row.expires_at,
    holdUntil: row.hold_until,
    paidAt: row.paid_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    disputeReason: row.dispute_reason,
    resolution: row.resolution,
    paymentCode: row.payment_code,
    buyerReportedAt: row.buyer_reported_at,
    event: {
      id: row.event_id,
      title: row.event_title ?? 'Событие',
      date: row.starts_at ? new Date(row.starts_at).toISOString() : null,
      venue: row.venue,
      city: row.city,
      address: row.address,
      doorsOpen: row.doors_open,
      cover: row.cover,
      image: row.image,
    },
    seller: { name: shortName(row.seller_first_name, row.seller_last_name) },
    buyer: { name: shortName(row.buyer_first_name, row.buyer_last_name) },
  };
}

// Брони, которые не оплатили вовремя, снимаются — объявление снова в продаже
export async function expireReservations(db) {
  await db.tx(async (t) => {
    const rows = await t.query(
      `UPDATE orders SET status = 'cancelled', closed_at = now(), resolution = 'Бронь истекла'
       WHERE status = 'pending' AND expires_at < now() AND buyer_reported_at IS NULL RETURNING listing_id`,
    );
    if (rows.length) {
      await t.query(`UPDATE listings SET status = 'active' WHERE id = ANY($1) AND status = 'reserved'`, [
        rows.map((r) => r.listing_id),
      ]);
    }
  });
}

// Деньги продавцу: из удержания — в его кошелёк (минус комиссия)
async function release(t, order, resolution) {
  const [locked] = await t.query(
    `UPDATE orders SET status = 'completed', closed_at = now(), resolution = $2
     WHERE id = $1 AND status IN ('paid', 'disputed') RETURNING *`,
    [order.id, resolution],
  );
  if (!locked) return null;
  await post(t, [
    { orderId: order.id, account: 'escrow', amount: -locked.amount },
    { orderId: order.id, userId: locked.seller_id, account: 'seller_balance', amount: locked.amount - locked.fee },
    ...(locked.fee ? [{ orderId: order.id, account: 'platform_fee', amount: locked.fee }] : []),
  ]);
  return locked;
}

// Возврат покупателю: из удержания — обратно; объявление снимается с причиной
async function refund(t, order, resolution, adminId) {
  const [locked] = await t.query(
    `UPDATE orders SET status = 'refunded', closed_at = now(), resolution = $2
     WHERE id = $1 AND status IN ('paid', 'disputed') RETURNING *`,
    [order.id, resolution],
  );
  if (!locked) return null;
  await post(t, [
    { orderId: order.id, account: 'escrow', amount: -locked.amount },
    { orderId: order.id, userId: locked.buyer_id, account: 'buyer_refund', amount: locked.amount },
  ]);
  await t.query(
    `UPDATE listings SET status = 'removed', removed_reason = $2, removed_by = $3, withdrawn_at = now() WHERE id = $1`,
    [locked.listing_id, `Сделка отменена, деньги возвращены покупателю: ${resolution}`, adminId],
  );
  return locked;
}

// Деньги получены (тест — сразу, вручную — после подтверждения владельцем): удержание начинается,
// билет продан. Пока шла оплата, объявление могла снять модерация — тогда оплату не принимаем.
async function markPaid(t, orderId, provider, paymentId, { requireUnexpired }) {
  const [order] = await t.query(
    `UPDATE orders o SET status = 'paid', paid_at = now(), provider = $4, provider_payment_id = $2,
            hold_until = e.starts_at + make_interval(hours => $3)
     FROM events e
     WHERE o.id = $1 AND o.status = 'pending' AND e.id = o.event_id ${requireUnexpired ? 'AND o.expires_at > now()' : ''}
     RETURNING o.*`,
    [orderId, paymentId, HOLD_HOURS_AFTER_START, provider],
  );
  if (!order) throw new HttpError(410, 'reservation_expired', 'Бронь истекла — выберите билет заново');
  await post(t, [
    { orderId: order.id, userId: order.buyer_id, account: 'buyer_payment', amount: -order.amount },
    { orderId: order.id, account: 'escrow', amount: order.amount },
  ]);
  const [sold] = await t.query(`UPDATE listings SET status = 'sold' WHERE id = $1 AND status = 'reserved' RETURNING id`, [
    order.listing_id,
  ]);
  if (!sold) throw new HttpError(409, 'listing_gone', 'Объявление сняли с продажи — оплата не принята');
  return order;
}

// Срок удержания вышел, спора нет — деньги продавцу. Вызывается по таймеру и перед чтением кошелька.
export async function releaseDue(db, notify) {
  const due = await db.query(`SELECT id FROM orders WHERE status = 'paid' AND hold_until < now() ORDER BY hold_until LIMIT 100`);
  for (const { id } of due) {
    const done = await db.tx((t) => release(t, { id }, 'Срок удержания истёк без спора'));
    if (done && notify) {
      void notify(Number(done.seller_id), `Деньги за проданный билет — ${rub(done.amount - done.fee)} — доступны в кошельке Tickety.`);
    }
  }
  return due.length;
}

// Подписанная ссылка на файл билета: открывается в браузере Telegram без заголовка авторизации
function signLink(secret, orderId, exp) {
  return createHmac('sha256', secret).update(`${orderId}.${exp}`).digest('base64url');
}

export function registerOrderRoutes(app, { db, config, requireUser, requirePermission, notify }) {
  const manual = config.paymentsMode === 'manual';
  const paymentsOn = () => {
    if (!['test', 'manual'].includes(config.paymentsMode)) throw new HttpError(503, 'payments_off', 'Оплата сейчас недоступна');
  };
  const canPayments = requirePermission('payments');

  // Заказ глазами покупателя: в ручном режиме неоплаченному — куда и с каким кодом переводить
  const view = (row, viewerId) => {
    const order = toOrder(row, viewerId);
    if (manual && order.role === 'buyer' && order.status === 'pending') {
      order.payment = { details: config.paymentDetails, code: row.payment_code, amount: row.amount };
    }
    return order;
  };
  const alertPayments = async (text) => {
    for (const id of await staffWith(db, config, 'payments')) void notify(id, text);
  };
  const linkSecret = config.botToken || config.linkSecret;

  // where может ссылаться на $2 — id того, кто спрашивает
  async function orderFor(req, where = 'TRUE') {
    const params = where.includes('$2') ? [req.params.id, req.user.id] : [req.params.id];
    const [row] = await db.query(`${ORDER_SELECT} WHERE o.id = $1 AND ${where}`, params);
    return row ?? null;
  }
  async function myOrder(req) {
    const row = await orderFor(req, 'o.buyer_id = $2');
    if (!row) throw new HttpError(404, 'order_not_found', 'Заказ не найден');
    return row;
  }
  // Повторно из базы — после изменения
  const reload = async (id, viewerId) => view((await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]))[0], viewerId);

  // Режим оплаты для приложения: test — тестовые деньги, manual — перевод с подтверждением, off — нет
  app.get('/api/config', async () => ({ payments: config.paymentsMode }));

  // ---- Покупатель ----

  // Бронь: объявление уходит с витрины на RESERVATION_MINUTES, пока покупатель платит
  app.post(
    '/api/orders',
    {
      preHandler: requireUser,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['listingId'],
          properties: { listingId: { type: 'string', pattern: UUID } },
        },
      },
    },
    async (req, reply) => {
      paymentsOn();
      if (req.user.blocked_at) throw new HttpError(403, 'blocked', 'Покупки для вашего аккаунта закрыты');
      await expireReservations(db);

      // Та же бронь у того же покупателя — вернуть её (повторное нажатие «Купить»)
      const [mine] = await db.query(
        `SELECT id FROM orders WHERE listing_id = $1 AND buyer_id = $2 AND status = 'pending'`,
        [req.body.listingId, req.user.id],
      );
      if (mine) return { order: await reload(mine.id, req.user.id) };

      const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM orders WHERE buyer_id = $1 AND status = 'pending'`, [
        req.user.id,
      ]);
      if (n >= MAX_PENDING_PER_BUYER) {
        throw new HttpError(429, 'too_many_reservations', 'Сначала оплатите или отмените уже забронированные билеты');
      }

      let orderId;
      try {
        orderId = await db.tx(async (t) => {
          const [listing] = await t.query(
            `SELECT l.*, e.starts_at, e.status AS event_status FROM listings l LEFT JOIN events e ON e.id = l.event_id
             WHERE l.id = $1 FOR UPDATE OF l`,
            [req.body.listingId],
          );
          if (!listing || listing.status === 'withdrawn' || listing.status === 'removed') {
            throw new HttpError(404, 'listing_not_found', 'Объявление снято с продажи');
          }
          if (listing.status !== 'active') throw new HttpError(409, 'listing_taken', 'Этот билет уже купили или бронируют');
          if (Number(listing.seller_id) === Number(req.user.id)) {
            throw new HttpError(400, 'own_listing', 'Свой билет купить нельзя');
          }
          if (listing.event_status !== 'published' || new Date(listing.starts_at) <= new Date()) {
            throw new HttpError(400, 'event_unavailable', 'Событие уже прошло или снято с продажи');
          }
          const amountBase = listing.price * listing.quantity;
          const fee = Math.round((amountBase * FEE_PERCENT) / 100);
          // Код для комментария к переводу: TK- и 6 знаков без похожих букв и цифр
          const code = `TK-${[...randomUUID().replace(/-/g, '')].filter((c) => /[2-9a-f]/.test(c)).slice(0, 6).join('').toUpperCase()}`;
          const [order] = await t.query(
            `INSERT INTO orders (listing_id, buyer_id, seller_id, event_id, quantity, price, amount, fee, expires_at, payment_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(mins => $9), $10) RETURNING id`,
            [listing.id, req.user.id, listing.seller_id, listing.event_id, listing.quantity, listing.price, amountBase + fee, fee,
              manual ? MANUAL_RESERVATION_MINUTES : RESERVATION_MINUTES, code],
          );
          await t.query(`UPDATE listings SET status = 'reserved' WHERE id = $1`, [listing.id]);
          return order.id;
        });
      } catch (err) {
        if (isUniqueViolation(err)) throw new HttpError(409, 'listing_taken', 'Этот билет уже купили или бронируют');
        throw err;
      }
      reply.code(201);
      return { order: await reload(orderId, req.user.id) };
    },
  );

  // Оплата. Бета: тестовый провайдер — деньги не списываются, но проводки те же, что будут с настоящим
  app.post(
    '/api/orders/:id/pay',
    {
      preHandler: requireUser,
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['method'],
          properties: { method: { type: 'string', enum: ['test'] } },
        },
      },
    },
    async (req) => {
      if (config.paymentsMode !== 'test') throw new HttpError(400, 'not_test', 'Тестовая оплата выключена');
      await expireReservations(db);
      const row = await myOrder(req);
      if (row.status === 'cancelled') throw new HttpError(410, 'reservation_expired', 'Бронь истекла — выберите билет заново');
      if (row.status !== 'pending') throw new HttpError(409, 'already_paid', 'Заказ уже оплачен');

      const paid = await db.tx((t) => markPaid(t, row.id, 'test', `test_${randomUUID()}`, { requireUnexpired: true }));
      notifySold(row, paid, '\n\n(Бета: тестовая оплата, настоящие деньги не списывались.)');
      return { order: await reload(paid.id, req.user.id) };
    },
  );

  function notifySold(row, paid, suffix = '') {
    void notify(
      Number(paid.seller_id),
      `Ваш билет купили: ${row.listing_title} — ${row.event_title}.\n\n${rub(paid.amount - paid.fee)} удерживаются Tickety до ${dateRu(paid.hold_until)} и придут в кошелёк, если покупатель не откроет спор.${suffix}`,
    );
  }

  // Ручной режим: покупатель сообщает, что перевёл. Бронь замирает до решения владельца.
  app.post('/api/orders/:id/report-paid', { preHandler: requireUser, schema: { params: idParams } }, async (req) => {
    if (!manual) throw new HttpError(400, 'not_manual', 'В этом режиме оплата проходит в приложении');
    await expireReservations(db);
    const row = await myOrder(req);
    if (row.status === 'cancelled') throw new HttpError(410, 'reservation_expired', 'Бронь истекла — если вы уже перевели деньги, напишите в поддержку');
    if (row.status !== 'pending') throw new HttpError(409, 'already_paid', 'Заказ уже оплачен');
    if (!row.buyer_reported_at) {
      await db.query(`UPDATE orders SET buyer_reported_at = now() WHERE id = $1 AND status = 'pending'`, [row.id]);
      await alertPayments(
        `Проверьте поступление: ${rub(row.amount)}, комментарий ${row.payment_code}.\n${row.listing_title} — ${row.event_title}, покупатель ${shortName(row.buyer_first_name, row.buyer_last_name)}${row.buyer_username ? ` (@${row.buyer_username})` : ''}.\n\nПодтвердить: Tickety → Админка → Сделки → Оплата`,
      );
    }
    return { order: await reload(row.id, req.user.id) };
  });

  app.post('/api/orders/:id/cancel', { preHandler: requireUser, schema: { params: idParams } }, async (req) => {
    const row = await myOrder(req);
    await db.tx(async (t) => {
      const [order] = await t.query(
        `UPDATE orders SET status = 'cancelled', closed_at = now(), resolution = 'Отменено покупателем'
         WHERE id = $1 AND status = 'pending' AND buyer_reported_at IS NULL RETURNING listing_id`,
        [row.id],
      );
      if (!order) {
        throw new HttpError(409, 'not_pending', 'Отменить можно только неоплаченную бронь. Если вы уже перевели деньги — напишите в поддержку');
      }
      await t.query(`UPDATE listings SET status = 'active' WHERE id = $1 AND status = 'reserved'`, [order.listing_id]);
    });
    return { order: await reload(row.id, req.user.id) };
  });

  // Покупки (как покупатель)
  app.get('/api/orders', { preHandler: requireUser }, async (req) => {
    await expireReservations(db);
    await releaseDue(db, notify);
    const rows = await db.query(
      `${ORDER_SELECT} WHERE o.buyer_id = $1 AND o.status <> 'cancelled' ORDER BY o.created_at DESC LIMIT 100`,
      [req.user.id],
    );
    return { orders: rows.map((r) => view(r, req.user.id)) };
  });

  app.get('/api/orders/:id', { preHandler: requireUser, schema: { params: idParams } }, async (req) => {
    await expireReservations(db);
    const row = await orderFor(req, '(o.buyer_id = $2 OR o.seller_id = $2)');
    if (!row) throw new HttpError(404, 'order_not_found', 'Заказ не найден');
    return { order: view(row, req.user.id) };
  });

  // «Я прошёл на событие» — деньги продавцу сразу, не дожидаясь срока
  app.post('/api/orders/:id/confirm', { preHandler: requireUser, schema: { params: idParams } }, async (req) => {
    const row = await myOrder(req);
    if (row.status !== 'paid') throw new HttpError(409, 'not_paid', 'Подтвердить можно только оплаченный заказ без спора');
    const done = await db.tx((t) => release(t, row, 'Покупатель подтвердил проход'));
    if (done) void notify(Number(done.seller_id), `Покупатель подтвердил проход. ${rub(done.amount - done.fee)} доступны в кошельке Tickety.`);
    return { order: await reload(row.id, req.user.id) };
  });

  // Спор: билет не сработал, не тот билет и т. п. Деньги остаются удержанными, пока команда не решит
  app.post(
    '/api/orders/:id/dispute',
    { preHandler: requireUser, schema: { params: idParams, body: reasonBody } },
    async (req) => {
      const row = await myOrder(req);
      const reason = req.body.reason.trim();
      const [order] = await db.query(
        `UPDATE orders SET status = 'disputed', dispute_reason = $2
         WHERE id = $1 AND status = 'paid' AND hold_until > now() RETURNING *`,
        [row.id, reason],
      );
      if (!order) throw new HttpError(409, 'dispute_closed', 'Спор можно открыть только по оплаченному заказу до окончания срока удержания');
      const message = `Спор по заказу: ${row.listing_title} — ${row.event_title}, ${rub(row.amount)}.\nПричина: ${excerpt(reason)}\n\nРешить: Tickety → Админка → Сделки`;
      for (const id of await staffWith(db, config, 'moderation')) void notify(id, message);
      void notify(
        Number(row.seller_id),
        `Покупатель открыл спор по билету «${row.listing_title}». Деньги остаются удержанными, пока команда Tickety разбирается. Мы можем с вами связаться.`,
      );
      return { order: await reload(row.id, req.user.id) };
    },
  );

  // Ссылка на файл билета — только покупателю оплаченного заказа
  app.post('/api/orders/:id/ticket-link', { preHandler: requireUser, schema: { params: idParams } }, async (req) => {
    const row = await myOrder(req);
    if (!['paid', 'disputed', 'completed'].includes(row.status)) {
      throw new HttpError(403, 'not_paid', 'Файл билета доступен после оплаты');
    }
    const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SEC;
    return { url: `/api/ticket-files/${row.id}.${exp}.${signLink(linkSecret, row.id, exp)}` };
  });

  app.get('/api/ticket-files/:token', async (req, reply) => {
    const [orderId, expRaw, sig] = String(req.params.token).split('.');
    const exp = Number(expRaw);
    const good = signLink(linkSecret, orderId, exp);
    if (!sig || !exp || sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) {
      throw new HttpError(403, 'bad_link', 'Ссылка недействительна');
    }
    if (exp < Date.now() / 1000) throw new HttpError(410, 'link_expired', 'Ссылка устарела — откройте билет в приложении заново');
    const [row] = await db.query(`${ORDER_SELECT} WHERE o.id = $1 AND o.status IN ('paid', 'disputed', 'completed')`, [orderId]);
    if (!row || !config.uploadDir) throw new HttpError(404, 'file_missing', 'Файл билета не найден');
    const ext = row.file_kind === 'jpeg' ? 'jpg' : row.file_kind;
    let file;
    try {
      file = await readFile(join(config.uploadDir, `${row.file_sha256}.${ext}`));
    } catch {
      throw new HttpError(404, 'file_missing', 'Файл билета не найден');
    }
    const type = { pdf: 'application/pdf', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' }[row.file_kind];
    reply
      .header('Content-Type', type)
      .header('Content-Disposition', `inline; filename="tickety-${row.id.slice(0, 8)}.${ext}"`)
      .header('Cache-Control', 'private, no-store');
    return reply.send(file);
  });

  // ---- Продавец: кошелёк ----

  async function wallet(userId) {
    const balances = await db.query(
      `SELECT account, COALESCE(sum(amount), 0)::int AS total FROM ledger_entries
       WHERE user_id = $1 AND account IN ('seller_balance', 'payout_pending', 'seller_paid_out') GROUP BY account`,
      [userId],
    );
    const byAccount = Object.fromEntries(balances.map((b) => [b.account, b.total]));
    const [{ held }] = await db.query(
      `SELECT COALESCE(sum(amount - fee), 0)::int AS held FROM orders WHERE seller_id = $1 AND status IN ('paid', 'disputed')`,
      [userId],
    );
    const sales = await db.query(
      `${ORDER_SELECT} WHERE o.seller_id = $1 AND o.status IN ('paid', 'disputed', 'completed', 'refunded') ORDER BY o.created_at DESC LIMIT 100`,
      [userId],
    );
    const payouts = await db.query(`SELECT * FROM payouts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, [userId]);
    return {
      held,
      available: byAccount.seller_balance ?? 0,
      pendingPayout: byAccount.payout_pending ?? 0,
      paidOut: byAccount.seller_paid_out ?? 0,
      sales: sales.map((r) => toOrder(r, userId)),
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        provider: p.provider,
        status: p.status,
        details: p.details,
        note: p.note,
        createdAt: p.created_at,
      })),
      mode: config.paymentsMode,
    };
  }

  app.get('/api/wallet', { preHandler: requireUser }, async (req) => {
    await releaseDue(db, notify);
    return { wallet: await wallet(req.user.id) };
  });

  // Вывод. Бета: тестовая отметка — настоящий перевод появится с платёжным сервисом
  app.post(
    '/api/wallet/payouts',
    {
      preHandler: requireUser,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['amount'],
          properties: {
            amount: { type: 'integer', minimum: 1 },
            bank: { type: 'string', minLength: 2, maxLength: 40 }, // ручной режим: банк для СБП
          },
        },
      },
    },
    async (req) => {
      paymentsOn();
      if (req.user.blocked_at) throw new HttpError(403, 'blocked', 'Вывод для вашего аккаунта закрыт — напишите в поддержку');
      if (manual) {
        // Выплата — только на подтверждённый номер самого продавца: чужие реквизиты подставить нельзя
        if (!req.user.phone_verified_at) throw new HttpError(403, 'phone_required', 'Подтвердите номер телефона — выплата придёт на него по СБП');
        if (!req.body.bank?.trim()) throw new HttpError(400, 'bank_required', 'Укажите банк, в который перевести по СБП');
      }
      await db.tx(async (t) => {
        await t.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [req.user.id]); // выводы одного продавца — по очереди
        const [{ available }] = await t.query(
          `SELECT COALESCE(sum(amount), 0)::int AS available FROM ledger_entries WHERE user_id = $1 AND account = 'seller_balance'`,
          [req.user.id],
        );
        if (req.body.amount > available) throw new HttpError(400, 'insufficient', `Доступно к выводу: ${rub(available)}`);
        if (manual) {
          const [payout] = await t.query(
            `INSERT INTO payouts (user_id, amount, provider, status, details) VALUES ($1, $2, 'manual', 'requested', $3) RETURNING id`,
            [req.user.id, req.body.amount, `СБП ${req.user.phone} • ${req.body.bank.trim()}`],
          );
          await post(t, [
            { payoutId: payout.id, userId: req.user.id, account: 'seller_balance', amount: -req.body.amount },
            { payoutId: payout.id, userId: req.user.id, account: 'payout_pending', amount: req.body.amount },
          ]);
          return;
        }
        const [payout] = await t.query(
          `INSERT INTO payouts (user_id, amount, provider, status) VALUES ($1, $2, 'test', 'paid') RETURNING id`,
          [req.user.id, req.body.amount],
        );
        await post(t, [
          { payoutId: payout.id, userId: req.user.id, account: 'seller_balance', amount: -req.body.amount },
          { payoutId: payout.id, userId: req.user.id, account: 'seller_paid_out', amount: req.body.amount },
        ]);
      });
      if (manual) {
        await alertPayments(`Заявка на выплату: ${rub(req.body.amount)} продавцу ${shortName(req.user.first_name, req.user.last_name)}, СБП ${req.user.phone} • ${req.body.bank.trim()}.\n\nОтметить: Tickety → Админка → Сделки → Выплаты`);
      }
      return { wallet: await wallet(req.user.id) };
    },
  );

  // ---- Команда: сделки и споры ----

  const canModerate = requirePermission('moderation');

  app.get(
    '/api/admin/orders',
    {
      preHandler: canModerate,
      schema: {
        querystring: {
          type: 'object',
          properties: { status: { type: 'string', enum: ['awaiting', 'disputed', 'paid', 'completed', 'refunded'] } },
        },
      },
    },
    async (req) => {
      await releaseDue(db, notify);
      const status = req.query.status ?? 'disputed';
      // awaiting — покупатель сообщил о переводе, владелец ещё не подтвердил
      const rows =
        status === 'awaiting'
          ? await db.query(`${ORDER_SELECT} WHERE o.status = 'pending' AND o.buyer_reported_at IS NOT NULL ORDER BY o.buyer_reported_at LIMIT 200`)
          : await db.query(`${ORDER_SELECT} WHERE o.status = $1 ORDER BY o.created_at DESC LIMIT 200`, [status]);
      return {
        orders: rows.map((r) => ({
          ...toOrder(r, null),
          buyer: {
            id: Number(r.buyer_id),
            name: shortName(r.buyer_first_name, r.buyer_last_name),
            username: r.buyer_username,
            // Для ручного возврата денег — подтверждённый номер покупателя (только команде)
            phone: r.buyer_phone_verified_at ? r.buyer_phone : null,
          },
          seller: { id: Number(r.seller_id), name: shortName(r.seller_first_name, r.seller_last_name), username: r.seller_username },
        })),
      };
    },
  );

  app.post(
    '/api/admin/orders/:id/refund',
    { preHandler: canModerate, schema: { params: idParams, body: reasonBody } },
    async (req) => {
      const reason = req.body.reason.trim();
      const done = await db.tx(async (t) => {
        const order = await refund(t, { id: req.params.id }, reason, req.user.id);
        if (!order) throw new HttpError(409, 'not_refundable', 'Вернуть можно только удерживаемые деньги (оплачено или спор)');
        await t.query(
          `INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES ($1, 'order_refund', 'order', $2, $3)`,
          [req.user.id, order.id, reason],
        );
        return order;
      });
      void notify(
        Number(done.buyer_id),
        done.provider === 'manual'
          ? `Tickety вернёт вам ${rub(done.amount)} за билет переводом — с вами свяжутся. ${reason}`
          : `Tickety вернул вам ${rub(done.amount)} за билет. ${reason}`,
      );
      void notify(Number(done.seller_id), `Сделка по вашему билету отменена, деньги возвращены покупателю. Причина: ${reason}`);
      return { order: toOrder((await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [done.id]))[0], null) };
    },
  );

  app.post(
    '/api/admin/orders/:id/release',
    { preHandler: canModerate, schema: { params: idParams, body: reasonBody } },
    async (req) => {
      const reason = req.body.reason.trim();
      const done = await db.tx(async (t) => {
        const order = await release(t, { id: req.params.id }, reason);
        if (!order) throw new HttpError(409, 'not_releasable', 'Отдать продавцу можно только удерживаемые деньги');
        await t.query(
          `INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES ($1, 'order_release', 'order', $2, $3)`,
          [req.user.id, order.id, reason],
        );
        return order;
      });
      void notify(Number(done.seller_id), `${rub(done.amount - done.fee)} за проданный билет доступны в кошельке Tickety.`);
      void notify(Number(done.buyer_id), `Спор по билету закрыт: деньги переданы продавцу. ${reason}`);
      return { order: toOrder((await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [done.id]))[0], null) };
    },
  );

  // ---- Владелец: ручные переводы ----

  // Деньги от покупателя пришли на карту — заказ оплачен, начинается удержание
  app.post('/api/admin/orders/:id/confirm-payment', { preHandler: canPayments, schema: { params: idParams } }, async (req) => {
    const [row] = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [req.params.id]);
    if (!row || row.status !== 'pending') throw new HttpError(409, 'not_pending', 'Заказ уже оплачен или отменён');
    const paid = await db.tx(async (t) => {
      const order = await markPaid(t, row.id, 'manual', row.payment_code, { requireUnexpired: false });
      await t.query(
        `INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES ($1, 'payment_confirm', 'order', $2, $3)`,
        [req.user.id, row.id, row.payment_code],
      );
      return order;
    });
    notifySold(row, paid);
    void notify(Number(paid.buyer_id), `Оплата подтверждена — билет «${row.listing_title}» в разделе «Мои билеты».`);
    return { order: toOrder((await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [row.id]))[0], null) };
  });

  // Перевод не пришёл — бронь снимается, билет снова в продаже
  app.post(
    '/api/admin/orders/:id/reject-payment',
    { preHandler: canPayments, schema: { params: idParams, body: reasonBody } },
    async (req) => {
      const reason = req.body.reason.trim();
      const order = await db.tx(async (t) => {
        const [o] = await t.query(
          `UPDATE orders SET status = 'cancelled', closed_at = now(), resolution = $2
           WHERE id = $1 AND status = 'pending' RETURNING *`,
          [req.params.id, `Оплата не подтверждена: ${reason}`],
        );
        if (!o) throw new HttpError(409, 'not_pending', 'Заказ уже оплачен или отменён');
        await t.query(`UPDATE listings SET status = 'active' WHERE id = $1 AND status = 'reserved'`, [o.listing_id]);
        await t.query(
          `INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES ($1, 'payment_reject', 'order', $2, $3)`,
          [req.user.id, o.id, reason],
        );
        return o;
      });
      void notify(Number(order.buyer_id), `Перевод по заказу ${order.payment_code} не найден: ${reason}. Если деньги списались — напишите в поддержку Tickety.`);
      return { ok: true };
    },
  );

  const PAYOUT_SELECT = `
    SELECT p.*, u.first_name, u.last_name, u.username FROM payouts p JOIN users u ON u.id = p.user_id`;
  const toPayout = (p) => ({
    id: p.id,
    amount: p.amount,
    status: p.status,
    details: p.details,
    note: p.note,
    createdAt: p.created_at,
    handledAt: p.handled_at,
    seller: { id: Number(p.user_id), name: shortName(p.first_name, p.last_name), username: p.username },
  });

  app.get(
    '/api/admin/payouts',
    {
      preHandler: canPayments,
      schema: { querystring: { type: 'object', properties: { status: { type: 'string', enum: ['requested', 'paid', 'rejected'] } } } },
    },
    async (req) => ({
      payouts: (
        await db.query(`${PAYOUT_SELECT} WHERE p.status = $1 ORDER BY p.created_at LIMIT 200`, [req.query.status ?? 'requested'])
      ).map(toPayout),
    }),
  );

  // Владелец перевёл продавцу — деньги уходят из «к выплате» в «выплачено»
  app.post('/api/admin/payouts/:id/paid', { preHandler: canPayments, schema: { params: idParams } }, async (req) => {
    const payout = await db.tx(async (t) => {
      const [p] = await t.query(
        `UPDATE payouts SET status = 'paid', handled_by = $2, handled_at = now() WHERE id = $1 AND status = 'requested' RETURNING *`,
        [req.params.id, req.user.id],
      );
      if (!p) throw new HttpError(409, 'not_requested', 'Заявка уже обработана');
      await post(t, [
        { payoutId: p.id, userId: p.user_id, account: 'payout_pending', amount: -p.amount },
        { payoutId: p.id, userId: p.user_id, account: 'seller_paid_out', amount: p.amount },
      ]);
      await t.query(`INSERT INTO admin_actions (admin_id, action, target_type, target_id) VALUES ($1, 'payout_paid', 'payout', $2)`, [
        req.user.id,
        p.id,
      ]);
      return p;
    });
    void notify(Number(payout.user_id), `Tickety перевёл вам ${rub(payout.amount)} (${payout.details}).`);
    return { payout: toPayout((await db.query(`${PAYOUT_SELECT} WHERE p.id = $1`, [payout.id]))[0]) };
  });

  // Отклонить заявку — деньги возвращаются в кошелёк продавца
  app.post(
    '/api/admin/payouts/:id/reject',
    { preHandler: canPayments, schema: { params: idParams, body: reasonBody } },
    async (req) => {
      const reason = req.body.reason.trim();
      const payout = await db.tx(async (t) => {
        const [p] = await t.query(
          `UPDATE payouts SET status = 'rejected', handled_by = $2, handled_at = now(), note = $3
           WHERE id = $1 AND status = 'requested' RETURNING *`,
          [req.params.id, req.user.id, reason],
        );
        if (!p) throw new HttpError(409, 'not_requested', 'Заявка уже обработана');
        await post(t, [
          { payoutId: p.id, userId: p.user_id, account: 'payout_pending', amount: -p.amount },
          { payoutId: p.id, userId: p.user_id, account: 'seller_balance', amount: p.amount },
        ]);
        await t.query(
          `INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES ($1, 'payout_reject', 'payout', $2, $3)`,
          [req.user.id, p.id, reason],
        );
        return p;
      });
      void notify(Number(payout.user_id), `Заявка на вывод ${rub(payout.amount)} отклонена: ${reason}. Деньги снова в кошельке.`);
      return { ok: true };
    },
  );
}
