// Туннель localhost.run с постоянным адресом для бота.
//
// Бесплатный localhost.run без предупреждения меняет адрес (старый отвечает «no tunnel»).
// Поэтому бот всегда открывает постоянную страницу на GitHub Pages (STABLE_URL, public/dev/),
// а она перебрасывает на живой адрес туннеля. Живой адрес скрипт при каждой смене записывает
// в tunnel.json в служебной ветке tunnel этого репозитория (через gh — нужен `gh auth login`).
// Ветка tunnel сборки не запускает. При остановке (Ctrl+C) пишется url: null —
// страница покажет «тестовый сервер выключен».
//
// Кнопка меню бота один раз ставится на STABLE_URL (Bot API setChatMenuButton);
// тот же адрес можно один раз вписать в BotFather как Main App.
//
// Запуск из корня проекта:  npm run tunnel:bot   (токен бота берётся из server/.env)
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const PORT = 5173;
const BUTTON_TEXT = 'Tickety';
const REPO = 'yaneponimaucheoniotmenyahotyat/tickety-twa';
const STABLE_URL = 'https://yaneponimaucheoniotmenyahotyat.github.io/tickety-twa/dev/';
const URL_RE = /https:\/\/[a-z0-9-]+\.lhr\.life/g;

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN не задан — запустите через npm run tunnel:bot (он читает server/.env)');
  process.exit(1);
}

const gh = (args) => promisify(execFile)('gh', args, { windowsHide: true });

// Живой адрес туннеля → tunnel.json в ветке tunnel (url: null — туннель выключен)
async function publishAddress(url) {
  const path = `repos/${REPO}/contents/tunnel.json`;
  const { stdout: sha } = await gh(['api', `${path}?ref=tunnel`, '--jq', '.sha']);
  const body = `${JSON.stringify({ url, updatedAt: new Date().toISOString() })}\n`;
  await gh([
    'api', '-X', 'PUT', path,
    '-f', `message=tunnel: ${url ?? 'off'}`,
    '-f', `content=${Buffer.from(body).toString('base64')}`,
    '-f', 'branch=tunnel',
    '-f', `sha=${sha.trim()}`,
  ]);
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
    await publishAddress(url);
    console.log(`[${time()}] туннель: ${url} — адрес опубликован, бот откроет его через ${STABLE_URL}`);
  } catch (e) {
    console.error(`[${time()}] туннель: ${url} — НЕ удалось опубликовать адрес: ${e.stderr || e.message}`);
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
    await publishAddress(null);
    console.log(`[${time()}] туннель остановлен — страница бота покажет «тестовый сервер выключен»`);
  } catch (e) {
    console.error(`[${time()}] НЕ удалось отметить туннель выключенным: ${e.stderr || e.message}`);
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

try {
  await setMenuButton(STABLE_URL);
  console.log(`[${time()}] кнопка бота: ${STABLE_URL}`);
} catch (e) {
  console.error(`[${time()}] НЕ удалось поставить кнопку бота: ${e.message}`);
}
console.log(`[${time()}] запускаю туннель к 127.0.0.1:${PORT}…`);
