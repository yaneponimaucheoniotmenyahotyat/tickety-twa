-- Покупка билетов с удержанием денег (эскроу) и кошелёк продавца.
-- Бета: оплата тестовая (provider = 'test'), но механика та же, что будет у платёжного сервиса
-- с «Безопасной сделкой»: деньги удерживаются до события, потом — продавцу или обратно покупателю.

-- reserved — объявление забронировано покупателем на время оплаты
ALTER TABLE listings DROP CONSTRAINT listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('active', 'reserved', 'withdrawn', 'sold', 'removed'));

-- Коды билета освобождаются, только если его сняли с продажи. Проданный билет второй раз
-- не выставить — иначе один билет можно было бы продать дважды.
DROP TRIGGER listings_free_codes ON listings;
CREATE TRIGGER listings_free_codes
  AFTER UPDATE OF status ON listings
  FOR EACH ROW
  WHEN (OLD.status IN ('active', 'reserved') AND NEW.status IN ('withdrawn', 'removed'))
  EXECUTE FUNCTION free_listing_codes();

-- Заказ. pending — бронь на время оплаты; paid — оплачено, деньги удерживаются;
-- disputed — покупатель открыл спор; completed — деньги ушли продавцу;
-- refunded — деньги вернулись покупателю; cancelled — бронь истекла или отменена.
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          UUID NOT NULL REFERENCES listings(id),
  buyer_id            BIGINT NOT NULL REFERENCES users(id),
  seller_id           BIGINT NOT NULL REFERENCES users(id),
  event_id            TEXT NOT NULL,
  quantity            INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 4),
  price               INTEGER NOT NULL CHECK (price > 0),        -- за билет
  amount              INTEGER NOT NULL CHECK (amount > 0),       -- всего к оплате
  fee                 INTEGER NOT NULL DEFAULT 0 CHECK (fee >= 0), -- комиссия Tickety
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'disputed', 'completed', 'refunded', 'cancelled')),
  provider            TEXT,
  provider_payment_id TEXT,
  expires_at          TIMESTAMPTZ NOT NULL,  -- конец брони
  hold_until          TIMESTAMPTZ,           -- до когда удерживаются деньги
  dispute_reason      TEXT,
  resolution          TEXT,                  -- как решён спор / почему вернули деньги
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at             TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ
);
-- Один билет — одна живая сделка: две брони одного объявления невозможны даже при гонке
CREATE UNIQUE INDEX orders_listing_live ON orders (listing_id) WHERE status IN ('pending', 'paid', 'disputed', 'completed');
CREATE INDEX orders_buyer ON orders (buyer_id, created_at DESC);
CREATE INDEX orders_seller ON orders (seller_id, created_at DESC);
CREATE INDEX orders_due ON orders (hold_until) WHERE status = 'paid';

-- Вывод денег продавцом. В бете — тестовая отметка, без перевода.
CREATE TABLE payouts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    BIGINT NOT NULL REFERENCES users(id),
  amount     INTEGER NOT NULL CHECK (amount > 0),
  provider   TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Журнал проводок: каждое движение денег — набор записей с общим tx_id и суммой 0.
-- Баланс кошелька = сумма записей по счёту, а не число в колонке, которое можно «подправить».
--   buyer_payment   — деньги пришли от покупателя (минус: «извне»)
--   escrow          — удерживаются Tickety по заказу
--   seller_balance  — доступно продавцу
--   seller_paid_out — выведено продавцом
--   buyer_refund    — возвращено покупателю
--   platform_fee    — комиссия Tickety
CREATE TABLE ledger_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id      UUID NOT NULL,
  order_id   UUID REFERENCES orders(id),
  payout_id  UUID REFERENCES payouts(id),
  user_id    BIGINT REFERENCES users(id),
  account    TEXT NOT NULL
             CHECK (account IN ('buyer_payment', 'escrow', 'seller_balance', 'seller_paid_out', 'buyer_refund', 'platform_fee')),
  amount     INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_user ON ledger_entries (user_id, account);
CREATE INDEX ledger_order ON ledger_entries (order_id);
