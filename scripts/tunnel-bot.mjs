// Туннель localhost.run + автообновление кнопки меню бота.
//
// Бесплатный localhost.run без предупреждения меняет адрес (старый отвечает «no tunnel»).
// Скрипт следит за выводом туннеля и при каждом новом адресе вызывает Bot API
// setChatMenuButton — кнопка «Tickety» в чате с ботом сразу ведёт на живой адрес.
// При остановке (Ctrl+C) кнопка возвращается на постоянный адрес GitHub Pages.
//
// Запуск из корня проекта:  npm run tunnel:bot   (токен берётся из server/.env)
import { spawn } from 'node:child_process';

const PORT = 5173;
const BUTTON_TEXT = 'Tickety';
const PERMANENT_URL = 'https://yaneponimaucheoniotmenyahotyat.github.io/tickety-twa/';
const URL_RE = /https:\/\/[a-z0-9-]+\.lhr\.life/g;

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN не задан — запустите через npm run tunnel:bot (он читает server/.env)');
  process.exit(1);
}

async function setMenuButton(url) {
  const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Без chat_id — кнопка по умолчанию для всех чатов с ботом
    body: JSON.stringify({ menu_button: { type: 'web_app', text: BUTTON_TEXT, web_app: { url } } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.description ?? `HTTP ${res.status}`);
}

const time = () => new Date().toLocaleTimeString('ru-RU');
let current = null;

const ssh = spawn(
  'ssh',
  // -C — сжатие внутри туннеля: бесплатный localhost.run медленный, а JS сжимается в ~3 раза
  ['-C', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ServerAliveInterval=30', '-o', 'BatchMode=yes',
    '-R', `80:127.0.0.1:${PORT}`, 'nokey@localhost.run'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

async function onOutput(chunk) {
  const urls = String(chunk).match(URL_RE);
  const url = urls?.at(-1);
  if (!url || url === current) return;
  current = url;
  try {
    await setMenuButton(url);
    console.log(`[${time()}] туннель: ${url} — кнопка бота обновлена`);
  } catch (e) {
    console.error(`[${time()}] туннель: ${url} — НЕ удалось обновить кнопку бота: ${e.message}`);
  }
}
ssh.stdout.on('data', onOutput);
ssh.stderr.on('data', onOutput);

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  ssh.kill();
  try {
    await setMenuButton(PERMANENT_URL);
    console.log(`[${time()}] кнопка бота возвращена на ${PERMANENT_URL}`);
  } catch (e) {
    console.error(`[${time()}] НЕ удалось вернуть кнопку бота: ${e.message} — верните адрес в @BotFather вручную`);
  }
  process.exit(code);
}

ssh.on('exit', (code) => {
  if (!stopping) {
    console.error(`[${time()}] туннель завершился (код ${code})`);
    stop(1);
  }
});
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.log(`[${time()}] запускаю туннель к 127.0.0.1:${PORT}…`);
