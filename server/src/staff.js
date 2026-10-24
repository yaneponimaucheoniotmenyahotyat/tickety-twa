// Команда Tickety и права доступа.
//   • владелец — Telegram id из ADMIN_IDS (server/.env): всё, включая управление командой
//     и деньги (payments: подтверждение переводов и выплаты — только он);
//   • moderator — события и модерация объявлений (и жалобы на объявления);
//   • support — обращения пользователей.
// Роли выдаёт и забирает только владелец; через API стать владельцем нельзя.
import { HttpError } from './errors.js';

export const ROLES = {
  moderator: { label: 'Модератор', permissions: ['events', 'moderation'] },
  support: { label: 'Поддержка', permissions: ['support'] },
};
const OWNER_PERMISSIONS = ['events', 'moderation', 'support', 'team', 'payments'];

// { owner, roles, permissions[] } для пользователя
export async function accessOf(db, config, userId) {
  const owner = config.adminIds.has(Number(userId));
  const roles = (await db.query(`SELECT role FROM staff WHERE user_id = $1 ORDER BY role`, [userId])).map((r) => r.role);
  const permissions = owner ? OWNER_PERMISSIONS : [...new Set(roles.flatMap((r) => ROLES[r].permissions))];
  return { owner, roles, permissions };
}

// Кому из команды есть дело до события: владельцы + все с нужным правом
export async function staffWith(db, config, permission) {
  const roles = Object.entries(ROLES)
    .filter(([, r]) => r.permissions.includes(permission))
    .map(([id]) => id);
  const rows = await db.query(`SELECT DISTINCT user_id FROM staff WHERE role = ANY($1)`, [roles]);
  return [...new Set([...config.adminIds, ...rows.map((r) => Number(r.user_id))])];
}

export async function isStaff(db, config, userId) {
  if (config.adminIds.has(Number(userId))) return true;
  const [row] = await db.query(`SELECT 1 FROM staff WHERE user_id = $1 LIMIT 1`, [userId]);
  return Boolean(row);
}

const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ');

export function registerStaffRoutes(app, { db, config, requirePermission, logAction }) {
  const team = requirePermission('team');

  app.get('/api/admin/staff', { preHandler: team }, async () => {
    const ids = [...new Set([...config.adminIds, ...(await db.query(`SELECT user_id FROM staff`)).map((r) => Number(r.user_id))])];
    const users = await db.query(
      `SELECT id, COALESCE(users.real_first_name, users.first_name) AS first_name, COALESCE(users.real_last_name, users.last_name) AS last_name, username FROM users WHERE id = ANY($1)`,
      [ids],
    );
    const roles = await db.query(`SELECT user_id, role FROM staff`);
    return {
      roles: Object.fromEntries(Object.entries(ROLES).map(([id, r]) => [id, r.label])),
      staff: ids.map((id) => {
        const u = users.find((x) => Number(x.id) === id);
        return {
          id,
          name: u ? fullName(u) : null, // владелец мог ещё не открывать приложение
          username: u?.username ?? null,
          owner: config.adminIds.has(id),
          roles: roles.filter((r) => Number(r.user_id) === id).map((r) => r.role),
        };
      }),
    };
  });

  app.post(
    '/api/admin/staff',
    {
      preHandler: team,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['userId', 'role'],
          properties: {
            userId: { type: 'integer', minimum: 1 },
            role: { type: 'string', enum: Object.keys(ROLES) },
          },
        },
      },
    },
    async (req) => {
      const { userId, role } = req.body;
      // Роль можно дать только тому, кто хоть раз открывал Tickety: так мы знаем, что id настоящий
      const [user] = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
      if (!user) {
        throw new HttpError(404, 'user_not_found', 'Этот человек ещё не открывал Tickety — пусть откроет приложение один раз');
      }
      await db.query(
        `INSERT INTO staff (user_id, role, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [userId, role, req.user.id],
      );
      await logAction(db, req.user.id, 'staff_add', 'user', userId, role);
      return { ok: true };
    },
  );

  app.delete(
    '/api/admin/staff/:userId/:role',
    {
      preHandler: team,
      schema: {
        params: {
          type: 'object',
          properties: { userId: { type: 'string', pattern: '^\\d{1,15}$' }, role: { type: 'string', enum: Object.keys(ROLES) } },
        },
      },
    },
    async (req) => {
      const rows = await db.query(`DELETE FROM staff WHERE user_id = $1 AND role = $2 RETURNING user_id`, [
        Number(req.params.userId),
        req.params.role,
      ]);
      if (!rows.length) throw new HttpError(404, 'not_found', 'У этого человека нет такой роли');
      await logAction(db, req.user.id, 'staff_remove', 'user', req.params.userId, req.params.role);
      return { ok: true };
    },
  );
}
