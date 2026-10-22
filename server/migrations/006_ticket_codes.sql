-- Код входа на билете (QR / штрихкод). Храним только отпечаток (SHA-256), не содержимое.
ALTER TABLE ticket_checks ADD COLUMN code_hashes TEXT[];
ALTER TABLE ticket_checks ADD COLUMN code_format TEXT;
ALTER TABLE listings ADD COLUMN code_format TEXT; -- NULL — объявление до проверки кодов

-- Коды активных объявлений: один код — одно объявление, даже если файл другой
-- (новый скриншот того же билета). Уникальный индекс ловит и одновременную публикацию.
CREATE TABLE listing_codes (
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  PRIMARY KEY (listing_id, code_hash)
);
CREATE UNIQUE INDEX listing_codes_hash ON listing_codes (code_hash);

-- Объявление ушло из продажи (снято, продано, модерация) — его коды освобождаются
CREATE FUNCTION free_listing_codes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM listing_codes WHERE listing_id = NEW.id;
  RETURN NEW;
END
$$;

CREATE TRIGGER listings_free_codes
  AFTER UPDATE OF status ON listings
  FOR EACH ROW
  WHEN (OLD.status = 'active' AND NEW.status <> 'active')
  EXECUTE FUNCTION free_listing_codes();
