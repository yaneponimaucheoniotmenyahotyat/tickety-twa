// Обратная связь: пользователь пишет в поддержку (вопрос, покупка, продажа, жалоба на объявление),
// команда отвечает в админке, бот присылает уведомления обеим сторонам.
// Имена сотрудников пользователю не показываем — для него отвечает «Поддержка Tickety».
import { HttpError } from './errors.js';
import { LISTING_SELECT, sellerName, toOffer } from './listings.js';
import { excerpt } from './notify.js';
import { staffWith } from './staff.js';

export const CATEGORIES = {
  question: 'Вопрос',
  buying: 'Покупка билета',
  selling: 'Продажа билета',
  complaint: 'Жалоба на объявление',
};
const MAX_OPEN_THREADS = 3; // защита от спама: больше незакрытых обращений не открыть
const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const idParams = { type: 'object', properties: { id: { type: 'string', pattern: UUID } } };
const messageBody = {
  type: 'object',
  additionalProperties: false,
  required: ['body'],
  properties: { body: { type: 'string', minLength: 1, maxLength: 2000 } },
};

const text = (s) => s.trim().replace(/\n{3,}/g, '\n\n');

function toMessage(m) {
  return { id: m.id, author: m.author, body: m.body, createdAt: m.created_at };
}

function toThread(t) {
  return {
    id: t.id,
    category: t.category,
    categoryLabel: CATEGORIES[t.category],
    status: t.status,
    listingId: t.listing_id,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    lastMessage: t.last_body ? { author: t.last_author, body: excerpt(t.last_body, 140) } : null,
  };
}

const THREAD_SELECT = `
  SELECT t.*, COALESCE(u.real_first_name, u.first_name) AS first_name, COALESCE(u.real_last_name, u.last_name) AS last_name, u.username,
         m.body AS last_body, m.author AS last_author
  FROM support_threads t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN LATERAL (
    SELECT body, author FROM support_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1
  ) m ON TRUE`;

export function registerSupportRoutes(app, { db, config, requireUser, requirePermission, notify }) {
  // Новое сообщение от пользователя — команде в Telegram (жалобы — ещё и модераторам)
  async function alertStaff(thread, body, isNew) {
    const ids = new Set(await staffWith(db, config, 'support'));
    if (thread.category === 'complaint') for (const id of await staffWith(db, config, 'moderation')) ids.add(id);
    const [user] = await db.query(
      `SELECT COALESCE(users.real_first_name, users.first_name) AS first_name, COALESCE(users.real_last_name, users.last_name) AS last_name, username FROM users WHERE id = $1`,
      [thread.user_id],
    );
    const who = `${sellerName(user)}${user.username ? ` (@${user.username})` : ''}`;
    const head = isNew ? `Новое обращение «${CATEGORIES[thread.category]}»` : `Новое сообщение в обращении «${CATEGORIES[thread.category]}»`;
    const message = `${head} от ${who}:\n\n${excerpt(body)}\n\nОтветить: Tickety → Профиль → Админка → Обращения`;
    for (const id of ids) if (id !== Number(thread.user_id)) void notify(id, message);
  }

  async function ownThread(req) {
    const [thread] = await db.query(`SELECT * FROM support_threads WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (!thread) throw new HttpError(404, 'thread_not_found', 'Обращение не найдено');
    return thread;
  }

  const messagesOf = async (threadId) =>
    (await db.query(`SELECT * FROM support_messages WHERE thread_id = $1 ORDER BY created_at`, [threadId])).map(toMessage);

  // ---- Пользователь ----

  app.get('/api/support/threads', { preHandler: requireUser }, async (req) => {
    const rows = await db.query(`${THREAD_SELECT} WHERE t.user_id = $1 ORDER BY t.updated_at DESC LIMIT 50`, [req.user.id]);
    return { threads: rows.map(toThread) };
  });

  app.post(
    '/api/support/threads',
    {
      preHandler: requireUser,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'body'],
          properties: {
            category: { type: 'string', enum: Object.keys(CATEGORIES) },
            body: { type: 'string', minLength: 1, maxLength: 2000 },
            listingId: { type: 'string', pattern: UUID },
          },
        },
      },
    },
    async (req, reply) => {
      const { category, listingId } = req.body;
      const body = text(req.body.body);
      if (body.length < 5) throw new HttpError(400, 'too_short', 'Опишите вопрос хотя бы парой слов');

      if (category === 'complaint') {
        if (!listingId) throw new HttpError(400, 'listing_required', 'Жалоба — на конкретное объявление');
        const [listing] = await db.query(`SELECT seller_id FROM listings WHERE id = $1`, [listingId]);
        if (!listing) throw new HttpError(404, 'listing_not_found', 'Объявление не найдено');
        if (Number(listing.seller_id) === Number(req.user.id)) {
          throw new HttpError(400, 'own_listing', 'На своё объявление пожаловаться нельзя');
        }
      } else if (listingId) {
        throw new HttpError(400, 'bad_request', 'Объявление указывается только в жалобе');
      }

      const [{ n }] = await db.query(
        `SELECT count(*)::int AS n FROM support_threads WHERE user_id = $1 AND status <> 'closed'`,
        [req.user.id],
      );
      if (n >= MAX_OPEN_THREADS) {
        throw new HttpError(429, 'too_many_threads', 'У вас уже есть открытые обращения — напишите в одно из них');
      }

      const thread = await db.tx(async (t) => {
        const [created] = await t.query(
          `INSERT INTO support_threads (user_id, category, listing_id) VALUES ($1, $2, $3) RETURNING *`,
          [req.user.id, category, listingId ?? null],
        );
        await t.query(`INSERT INTO support_messages (thread_id, author, author_id, body) VALUES ($1, 'user', $2, $3)`, [
          created.id,
          req.user.id,
          body,
        ]);
        return created;
      });
      await alertStaff(thread, body, true);
      reply.code(201);
      return { thread: toThread(thread), messages: await messagesOf(thread.id) };
    },
  );

  app.get('/api/support/threads/:id', { preHandler: requireUser, schema: { params: idParams } }, async (req) => {
    const thread = await ownThread(req);
    return { thread: toThread(thread), messages: await messagesOf(thread.id) };
  });

  // Сообщение пользователя: обращение снова ждёт ответа (закрытое — открывается заново)
  app.post(
    '/api/support/threads/:id/messages',
    { preHandler: requireUser, schema: { params: idParams, body: messageBody } },
    async (req) => {
      const body = text(req.body.body);
      if (!body) throw new HttpError(400, 'empty', 'Пустое сообщение');
      const thread = await ownThread(req);
      await db.query(`INSERT INTO support_messages (thread_id, author, author_id, body) VALUES ($1, 'user', $2, $3)`, [
        thread.id,
        req.user.id,
        body,
      ]);
      const [updated] = await db.query(
        `UPDATE support_threads SET status = 'open', updated_at = now() WHERE id = $1 RETURNING *`,
        [thread.id],
      );
      await alertStaff(updated, body, false);
      return { thread: toThread(updated), messages: await messagesOf(thread.id) };
    },
  );

  // ---- Команда ----
  // support видит все обращения; moderation (без support) — только жалобы на объявления

  const staffOnly = async (req) => {
    const can = req.access.permissions;
    if (!can.includes('support') && !can.includes('moderation')) {
      throw new HttpError(403, 'forbidden', 'Нужны права поддержки');
    }
  };
  const visibleTo = (req) => (req.access.permissions.includes('support') ? 'TRUE' : `t.category = 'complaint'`);

  async function staffThread(req) {
    const [thread] = await db.query(`${THREAD_SELECT} WHERE t.id = $1 AND ${visibleTo(req)}`, [req.params.id]);
    if (!thread) throw new HttpError(404, 'thread_not_found', 'Обращение не найдено');
    return thread;
  }

  async function staffView(req, thread) {
    let listing = null;
    if (thread.listing_id) {
      const [row] = await db.query(`${LISTING_SELECT} WHERE l.id = $1`, [thread.listing_id]);
      if (row) {
        const [event] = await db.query(`SELECT title FROM events WHERE id = $1`, [row.event_id]);
        listing = { ...toOffer(row, null), sellerId: Number(row.seller_id), eventTitle: event?.title ?? row.event_id };
      }
    }
    return {
      thread: {
        ...toThread(thread),
        user: { id: Number(thread.user_id), name: sellerName(thread), username: thread.username },
      },
      listing,
      messages: await messagesOf(thread.id),
    };
  }

  app.get(
    '/api/admin/support',
    {
      preHandler: [requirePermission.attach, staffOnly],
      schema: { querystring: { type: 'object', properties: { status: { type: 'string', enum: ['open', 'answered', 'closed'] } } } },
    },
    async (req) => {
      const rows = await db.query(
        `${THREAD_SELECT} WHERE t.status = $1 AND ${visibleTo(req)} ORDER BY t.updated_at ${req.query.status === 'open' || !req.query.status ? 'ASC' : 'DESC'} LIMIT 200`,
        [req.query.status ?? 'open'],
      );
      return {
        threads: rows.map((t) => ({
          ...toThread(t),
          user: { id: Number(t.user_id), name: sellerName(t), username: t.username },
        })),
      };
    },
  );

  app.get(
    '/api/admin/support/:id',
    { preHandler: [requirePermission.attach, staffOnly], schema: { params: idParams } },
    async (req) => staffView(req, await staffThread(req)),
  );

  // Ответ команды: пользователю приходит сообщение от бота
  app.post(
    '/api/admin/support/:id/messages',
    { preHandler: [requirePermission.attach, staffOnly], schema: { params: idParams, body: messageBody } },
    async (req) => {
      const body = text(req.body.body);
      if (!body) throw new HttpError(400, 'empty', 'Пустое сообщение');
      const thread = await staffThread(req);
      await db.query(`INSERT INTO support_messages (thread_id, author, author_id, body) VALUES ($1, 'staff', $2, $3)`, [
        thread.id,
        req.user.id,
        body,
      ]);
      await db.query(`UPDATE support_threads SET status = 'answered', updated_at = now() WHERE id = $1`, [thread.id]);
      void notify(
        Number(thread.user_id),
        `Поддержка Tickety ответила на ваше обращение «${CATEGORIES[thread.category]}»:\n\n${excerpt(body, 600)}\n\nОтветить можно в Tickety → Профиль → Поддержка`,
      );
      return staffView(req, await staffThread(req));
    },
  );

  app.post(
    '/api/admin/support/:id/close',
    { preHandler: [requirePermission.attach, staffOnly], schema: { params: idParams } },
    async (req) => {
      const thread = await staffThread(req);
      await db.query(`UPDATE support_threads SET status = 'closed', updated_at = now() WHERE id = $1`, [thread.id]);
      return staffView(req, await staffThread(req));
    },
  );
}
