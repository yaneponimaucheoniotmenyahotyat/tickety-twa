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

Авторизация: `Authorization: tma <initData>` — строка `Telegram.WebApp.initData` как есть.
Сервер проверяет HMAC-подпись токеном бота и свежесть `auth_date` (по умолчанию сутки).

## Миграции

SQL-файлы в `migrations/` применяются по порядку при старте, каждый один раз
(учёт — таблица `schema_migrations`). Новая миграция — новый файл `002_….sql`;
старые файлы не редактируются.
