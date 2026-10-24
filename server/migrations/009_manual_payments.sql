-- Ручной режим оплаты (PAYMENTS_MODE=manual): покупатель переводит деньги владельцу Tickety
-- по реквизитам из server/.env, владелец подтверждает поступление и сам платит продавцам.
-- Механика удержания та же — меняется только то, кто и как двигает деньги снаружи.

-- Покупатель сообщил «Я перевёл»: бронь больше не истекает, ждём подтверждения команды
ALTER TABLE orders ADD COLUMN buyer_reported_at TIMESTAMPTZ;
-- Код в комментарии к переводу — чтобы сопоставить поступление с заказом
ALTER TABLE orders ADD COLUMN payment_code TEXT;

-- Выплата продавцу: requested — заявка, paid — владелец перевёл, rejected — отклонена (деньги вернулись в кошелёк)
ALTER TABLE payouts DROP CONSTRAINT payouts_status_check;
ALTER TABLE payouts ADD CONSTRAINT payouts_status_check CHECK (status IN ('requested', 'paid', 'rejected'));
ALTER TABLE payouts ADD COLUMN details TEXT;          -- куда перевести (банк для СБП на подтверждённый номер)
ALTER TABLE payouts ADD COLUMN handled_by BIGINT REFERENCES users(id);
ALTER TABLE payouts ADD COLUMN handled_at TIMESTAMPTZ;
ALTER TABLE payouts ADD COLUMN note TEXT;

-- payout_pending — запрошено продавцом, но ещё не переведено
ALTER TABLE ledger_entries DROP CONSTRAINT ledger_entries_account_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_account_check CHECK (
  account IN ('buyer_payment', 'escrow', 'seller_balance', 'payout_pending', 'seller_paid_out', 'buyer_refund', 'platform_fee')
);
