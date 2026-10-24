// Публичная оферта: без согласия с текущей редакцией нельзя продавать, покупать и выводить деньги.
// Смотреть витрину и писать в поддержку можно и без согласия.
import { OFFER } from '../../shared/legal/offer.js';
import { HttpError } from './errors.js';

export async function offerAccepted(db, userId) {
  const [row] = await db.query(
    `SELECT accepted_at FROM legal_acceptances WHERE user_id = $1 AND document = $2 AND version = $3`,
    [userId, OFFER.id, OFFER.version],
  );
  return row?.accepted_at ?? null;
}

export async function assertOfferAccepted(db, config, user) {
  if (!config.offerRequired) return;
  if (!(await offerAccepted(db, user.id))) {
    throw new HttpError(403, 'offer_required', 'Чтобы покупать и продавать, примите условия публичной оферты');
  }
}

export function registerLegalRoutes(app, { db, requireUser }) {
  // Согласие с конкретной редакцией: устаревшую принять нельзя — приложение должно показать новую
  app.post(
    '/api/me/accept-offer',
    {
      preHandler: requireUser,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { version: { type: 'string', maxLength: 32 } },
        },
      },
    },
    async (req) => {
      if (req.body.version !== OFFER.version) {
        throw new HttpError(409, 'offer_outdated', 'Условия обновились — откройте приложение заново и прочитайте новую редакцию');
      }
      await db.query(
        `INSERT INTO legal_acceptances (user_id, document, version) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [req.user.id, OFFER.id, OFFER.version],
      );
      return { offer: { version: OFFER.version, acceptedAt: await offerAccepted(db, req.user.id) } };
    },
  );
}
