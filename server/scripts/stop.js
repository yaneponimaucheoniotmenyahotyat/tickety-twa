// npm run stop — аккуратно остановить локальный сервер (база закроется без повреждений).
// Нужен, потому что на Windows Ctrl+C до фонового процесса не доходит, а «убить» его опасно для PGlite.
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT) || 8787;
let token;
try {
  token = (await readFile(new URL('../.data/.stop-token', import.meta.url), 'utf8')).trim();
} catch {
  console.log('Сервер не запущен (нет .data/.stop-token)');
  process.exit(0);
}
try {
  const res = await fetch(`http://127.0.0.1:${port}/__local/stop`, { method: 'POST', headers: { 'x-stop-token': token } });
  console.log(res.ok ? 'Сервер останавливается…' : `Сервер ответил ${res.status}`);
} catch {
  console.log('Сервер не отвечает — похоже, уже остановлен');
}
