import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { initTelegram, isTelegram } from './lib/telegram';
import './index.css';

// До первого рендера: тема применяется сразу, без мигания светлым фоном.
initTelegram();

// Консоль на телефоне (шестерёнка в углу) — только в dev внутри Telegram или с ?eruda.
// В production-сборку не попадает: ветка вырезается вместе с import.meta.env.DEV.
if (import.meta.env.DEV && (isTelegram || location.search.includes('eruda'))) {
  import('eruda').then(({ default: eruda }) => eruda.init());
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* HashRouter: Telegram передаёт параметры в hash (#tgWebAppData=…) и
        статический хостинг не требует rewrite-правил. Скрипт telegram-web-app.js
        уже прочитал их к этому моменту. */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
