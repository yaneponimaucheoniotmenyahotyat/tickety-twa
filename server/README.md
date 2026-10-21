# Tickety API

Fastify + PostgreSQL. Вход — через подпись Telegram `initData`, паролей нет.

## Локальный запуск

```bash
cd server
npm install
copy .env.example .env   # заполните BOT_TOKEN
npm run dev              # http://127.0.0.1:8787
```

Без `DATABASE_URL` используется **PGlite** — настоящий PostgreSQL внутри Node,
данные в `server/.data/`. На хостинге задайте `DATABASE_URL` обычного PostgreSQL.

Приложение ходит на сервер, если при сборке задан `VITE_API_URL`
(локально — в `.env.development.local` в корне проекта).

### Разработка в браузере без Telegram

В браузере нет подписи Telegram. Для локальной отладки:

- `server/.env`: `ALLOW_DEV_AUTH=1`
- `.env.development.local`: `VITE_DEV_USER_ID=1001`

Тогда запросы идут с заголовком `Authorization: dev 1001`.
С `NODE_ENV=production` сервер с `ALLOW_DEV_AUTH=1` **не запустится**.

## Тесты

```bash
npm test
```

## API

| Метод | Путь | Доступ | Что делает |
|---|---|---|---|
| GET | `/api/health` | все | Проверка сервера и базы |
| GET | `/api/me` | Telegram | Текущий пользователь; создаётся при первом входе |
| GET | `/api/listings` | все | Активные объявления (с `own: true` для своих, если вошли) |
| GET | `/api/me/listings` | Telegram | Мои объявления, включая снятые |
| POST | `/api/ticket-checks` | Telegram | multipart `eventId` + `file`: проверка билета → `checkId` и распознанные данные |
| POST | `/api/listings` | Telegram | `{ checkId, price, quantity, sector?, row?, seat? }` → объявление |
| POST | `/api/listings/:id/withdraw` | Telegram (владелец) | Снять с продажи |

### Что сервер не доверяет клиенту

- **Формат файла** — по сигнатуре (первым байтам): PDF, JPEG, PNG, WebP, HEIC. Имя и MIME от клиента не важны.
- **Номинал и зона** — из проверки билета на сервере. Поля `nominal` в API нет; лишние поля в теле — `400`.
- **Цена ≤ номинала** — проверяет сервер, и дополнительно ограничение `price_not_above_nominal` в базе.
- **Дубли** — один штрихкод может быть только в одном активном объявлении (уникальный индекс).
- **Чужое** — чужую проверку не использовать, чужое объявление не снять (`404`).

Файлы билетов сохраняются в `server/.data/uploads/<sha256>.<ext>` (`UPLOAD_DIR`).
На хостинге нужен постоянный диск или объектное хранилище (S3).

«Распознавание» ИИ пока имитация: зона и места выводятся из SHA-256 файла
(`shared/listingRules.js`). Настоящее чтение штрихкода и сверка с организатором — позже.

Авторизация: `Authorization: tma <initData>` — строка `Telegram.WebApp.initData` как есть.
Сервер проверяет HMAC-подпись токеном бота и свежесть `auth_date` (по умолчанию сутки).

## Миграции

SQL-файлы в `migrations/` применяются по порядку при старте, каждый один раз
(учёт — таблица `schema_migrations`). Новая миграция — новый файл `002_….sql`;
старые файлы не редактируются.
