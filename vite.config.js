import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { fileURLToPath, URL } from 'node:url';

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

// Режим tunnel (npm run dev:tunnel): сервер доступен только через HTTPS-туннель,
// HMR-сокет идёт через тот же туннель (wss, порт 443), а не на :5173.
export default defineConfig(({ mode }) => ({
  base: './', // TWA часто хостится не в корне домена
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
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
    watch: { ignored: ['**/*.url', '**/*.crdownload', '**/*.tmp', '**/*.partial'] },
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: TUNNEL_HOSTS,
  },
}));
