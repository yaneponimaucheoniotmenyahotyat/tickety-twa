-- Регистрация: настоящие имя и фамилия, которые пользователь вводит сам.
-- Отдельно от first_name/last_name: те приходят из Telegram и перезаписываются при каждом входе.
-- Это не проверенные документами данные — их подтверждают только номер телефона и модерация.
ALTER TABLE users ADD COLUMN real_first_name TEXT;
ALTER TABLE users ADD COLUMN real_last_name TEXT;
ALTER TABLE users ADD COLUMN registered_at TIMESTAMPTZ;
