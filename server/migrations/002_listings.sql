-- Проверка загруженного билета: что «распознал ИИ» и откуда (хэш файла).
-- Объявление ссылается на проверку — номинал и места берутся отсюда, а не от клиента.
CREATE TABLE ticket_checks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL REFERENCES users(id),
  event_id    TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  file_kind   TEXT NOT NULL CHECK (file_kind IN ('pdf', 'jpeg', 'png', 'webp', 'heic')),
  file_size   INTEGER NOT NULL,
  zone        TEXT NOT NULL,
  seated      BOOLEAN NOT NULL,
  sector      TEXT,
  row_label   TEXT,
  seat_label  TEXT,
  nominal     INTEGER NOT NULL CHECK (nominal > 0),
  barcode     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    BIGINT NOT NULL REFERENCES users(id),
  event_id     TEXT NOT NULL,
  check_id     UUID NOT NULL UNIQUE REFERENCES ticket_checks(id), -- одна проверка — одно объявление
  barcode      TEXT NOT NULL,
  zone         TEXT NOT NULL,
  title        TEXT NOT NULL,
  file_kind    TEXT NOT NULL,
  nominal      INTEGER NOT NULL,
  price        INTEGER NOT NULL,
  quantity     INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'sold')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ,
  -- «Честная цена» на уровне базы: даже ошибка в коде не пропустит цену выше номинала
  CONSTRAINT price_not_above_nominal CHECK (price > 0 AND price <= nominal),
  CONSTRAINT quantity_range CHECK (quantity BETWEEN 1 AND 4)
);

-- Один билет (штрихкод) не может продаваться дважды одновременно
CREATE UNIQUE INDEX listings_active_barcode ON listings (barcode) WHERE status = 'active';
CREATE INDEX listings_active_event ON listings (event_id) WHERE status = 'active';
CREATE INDEX listings_seller ON listings (seller_id, created_at DESC);
