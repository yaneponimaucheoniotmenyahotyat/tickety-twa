-- Подтверждённый номер телефона — минимальная проверка продавца (без юрлица доступна только она).
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN phone_verified_at TIMESTAMPTZ;

-- Журнал проверок личности. Сейчас — только telegram_phone; позже сюда же
-- встанут Госуслуги (esia), Сбер ID, Т-ID без переделки схемы.
CREATE TABLE identity_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL REFERENCES users(id),
  method      TEXT NOT NULL CHECK (method IN ('telegram_phone', 'esia', 'sber_id', 't_id')),
  subject     TEXT NOT NULL,          -- номер телефона / идентификатор у провайдера
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX identity_verifications_user ON identity_verifications (user_id, verified_at DESC);
