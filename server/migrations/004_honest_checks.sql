-- Честная проверка билета: без имитации «распознавания ИИ».
-- Зону и места указывает продавец, номинал — из прайса зоны, дубли — по содержимому файла.

-- Поля «распознавания» в проверке больше не заполняются
ALTER TABLE ticket_checks
  ALTER COLUMN zone DROP NOT NULL,
  ALTER COLUMN seated DROP NOT NULL,
  ALTER COLUMN nominal DROP NOT NULL,
  ALTER COLUMN barcode DROP NOT NULL;

-- Дубли: один и тот же файл не может быть в двух активных объявлениях
ALTER TABLE listings ADD COLUMN file_sha256 TEXT;
UPDATE listings l SET file_sha256 = c.file_sha256 FROM ticket_checks c WHERE c.id = l.check_id;
ALTER TABLE listings ALTER COLUMN file_sha256 SET NOT NULL;
ALTER TABLE listings ALTER COLUMN barcode DROP NOT NULL;

DROP INDEX listings_active_barcode;
CREATE UNIQUE INDEX listings_active_file ON listings (file_sha256) WHERE status = 'active';
