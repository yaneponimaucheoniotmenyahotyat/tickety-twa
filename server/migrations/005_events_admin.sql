-- События и прайс зон — в базе, их заводит администратор по официальному прайсу организатора.
-- Миграция событий не создаёт: на чистом сервере каталог пуст. Демо-события для локальной
-- разработки — отдельной командой `npm run seed:demo`.
CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('concert', 'theatre', 'standup', 'festival')),
  tags        TEXT[] NOT NULL DEFAULT '{}',
  starts_at   TIMESTAMPTZ NOT NULL,
  doors_open  TEXT,                        -- «17:30»
  venue       TEXT NOT NULL,
  city        TEXT NOT NULL,
  address     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cover       TEXT[] NOT NULL,             -- три цвета градиента обложки
  image       TEXT,
  source_url  TEXT,                        -- откуда взят прайс (страница организатора)
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_by  BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Зона — строка прайса: номинал задаёт администратор, продавец его не меняет
CREATE TABLE event_zones (
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  id           TEXT NOT NULL,
  label        TEXT NOT NULL,
  nominal      INTEGER NOT NULL CHECK (nominal > 0),
  seated       BOOLEAN NOT NULL,             -- нужны ряд и место
  needs_sector BOOLEAN NOT NULL,             -- нужен ещё и сектор
  position     INTEGER NOT NULL,
  PRIMARY KEY (event_id, id)
);

-- Модерация: объявление может снять администратор (с причиной), продавца — заблокировать
ALTER TABLE listings DROP CONSTRAINT listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check CHECK (status IN ('active', 'withdrawn', 'sold', 'removed'));
ALTER TABLE listings ADD COLUMN removed_reason TEXT;
ALTER TABLE listings ADD COLUMN removed_by BIGINT REFERENCES users(id);

ALTER TABLE users ADD COLUMN blocked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN blocked_reason TEXT;

-- Журнал действий администраторов: кто, что и почему
CREATE TABLE admin_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    BIGINT NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX admin_actions_created ON admin_actions (created_at DESC);
