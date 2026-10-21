-- Пользователи = аккаунты Telegram. Пароля нет: личность подтверждает подпись initData.
CREATE TABLE users (
  id                 BIGINT PRIMARY KEY,          -- Telegram user id
  first_name         TEXT NOT NULL,
  last_name          TEXT,
  username           TEXT,
  photo_url          TEXT,
  language_code      TEXT,
  is_premium         BOOLEAN NOT NULL DEFAULT FALSE,
  allows_write_to_pm BOOLEAN NOT NULL DEFAULT FALSE, -- можно ли боту писать первым
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
