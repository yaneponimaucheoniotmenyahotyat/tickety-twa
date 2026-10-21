// Запуск сервера, доступного из интернета (через туннель): npm run public
// Отличия от npm run dev:
//   • dev-вход «Authorization: dev <id>» выключен принудительно, даже если в .env ALLOW_DEV_AUTH=1 —
//     иначе любой, кто узнал адрес туннеля, вошёл бы под чужим id;
//   • без BOT_TOKEN не стартует — пускать можно только по настоящей подписи Telegram.
process.env.ALLOW_DEV_AUTH = '0';

if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN не задан в server/.env — без него вход через Telegram невозможен.');
  process.exit(1);
}

await import('./index.js');
