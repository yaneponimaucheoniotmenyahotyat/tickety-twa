import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// В GitHub Actions доступен SHA коммита — по нему видно, какая сборка открыта на телефоне
const commit = (process.env.GITHUB_SHA || 'local').slice(0, 7);

// SVGO: чистим метаданные Figma, сохраняем viewBox, размер — через className.
const svgo = (extraPlugins = []) => ({
  plugins: [
    // cleanupIds выключен: иначе id градиентов разных SVG сожмутся в одинаковые "a"
    // и при инлайне на одной странице логотипы возьмут чужой градиент.
    { name: 'preset-default', params: { overrides: { removeViewBox: false, cleanupIds: false } } },
    'removeDimensions',
    'removeXMLNS',
    { name: 'removeAttrs', params: { attrs: ['data-name', 'class'] } },
    ...extraPlugins,
  ],
});

const svgrFor = (include, svgoConfig) =>
  svgr({
    include,
    svgrOptions: {
      plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
      dimensions: false,
      svgoConfig,
    },
  });

// Публичные адреса туннелей:
//   localhost.run → https://<id>.lhr.life (основной: работает через ssh, без установки)
//   Cloudflare    → https://<слова>.trycloudflare.com (у части провайдеров РФ режется DPI)
const TUNNEL_HOSTS = ['.lhr.life', '.trycloudflare.com'];

// Запросы /api с того же адреса пересылаются локальному серверу (server/, порт 8787).
// Так через один туннель идут и приложение, и API — без отдельного адреса и CORS.
const API_PROXY = { '/api': 'http://127.0.0.1:8787' };

// vite preview отдаёт файлы без сжатия, а бесплатный туннель медленный (~35 КБ/с):
// JS и CSS сжимаем gzip один раз и держим в памяти — через туннель идёт втрое меньше
const previewGzip = () => {
  const cache = new Map();
  return {
    name: 'preview-gzip',
    configurePreviewServer(server) {
      const root = server.config.build.outDir;
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : null;
        if (!type || !/gzip/.test(req.headers['accept-encoding'] ?? '') || path.includes('..')) return next();
        let body = cache.get(path);
        if (!body) {
          try {
            body = gzipSync(readFileSync(`${root}${decodeURIComponent(path)}`), { level: 9 });
          } catch {
            return next(); // нет такого файла — пусть ответит сам preview
          }
          cache.set(path, body);
        }
        res.setHeader('Content-Type', `${type}; charset=utf-8`);
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // имена файлов с хэшем
        res.end(body);
      });
    },
  };
};

// Режимы:
//   tunnel    (npm run dev:tunnel) — HMR-сокет идёт через туннель (wss, порт 443), а не на :5173
//   phone-api (npm run phone:api)  — сборка ходит в API по тому же адресу (VITE_API_URL=/)
export default defineConfig(({ mode }) => ({
  base: './', // TWA часто хостится не в корне домена
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
    ...(mode === 'phone-api' ? { 'import.meta.env.VITE_API_URL': JSON.stringify('/') } : {}),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    previewGzip(),
    // icons/mono/*  — монохромные иконки (табы, календарь, лупа, щит):
    //                все цвета → currentColor, красятся через text-brand и т.п.
    svgrFor('**/assets/icons/mono/*.svg?react', svgo([{ name: 'convertColors', params: { currentColor: true } }])),
    // icons/color/* — многоцветные (СБП, SberPay, T-Pay, Yandex Pay): цвета не трогаем.
    svgrFor('**/assets/icons/color/*.svg?react', svgo()),
  ],
  server: {
    // Только loopback: в сеть приложение выходит через туннель, а не через LAN
    host: '127.0.0.1',
    port: 5173,
    strictPort: true, // туннель смотрит на фиксированный порт
    allowedHosts: mode === 'tunnel' ? TUNNEL_HOSTS : [],
    hmr: mode === 'tunnel' ? { protocol: 'wss', clientPort: 443 } : undefined,
    // Временные файлы браузера/Windows в папке проекта бывают заблокированы (EBUSY)
    // и роняют наблюдатель — их не отслеживаем.
    // + база и снимки сервера: наблюдатель держит папки открытыми, и Windows не даёт их переименовать
    watch: { ignored: ['**/*.url', '**/*.crdownload', '**/*.tmp', '**/*.partial', '**/server/.data*/**', '**/server/.backups/**'] },
    proxy: API_PROXY,
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: TUNNEL_HOSTS,
    proxy: API_PROXY,
  },
}));
