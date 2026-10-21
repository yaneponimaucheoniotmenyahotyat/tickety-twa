/** @type {import('tailwindcss').Config} */

// Цвет из CSS-переменной в формате "R G B" — работают модификаторы прозрачности (bg-brand/10).
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class'], // класс .dark ставит telegram.js по webApp.colorScheme
  theme: {
    extend: {
      colors: {
        // Поверхности — из темы Telegram (см. index.css)
        bg: v('--app-bg'),             // фон экрана (iOS grouped background)
        surface: v('--app-surface'),   // карточки, секции
        fill: v('--app-fill'),         // чипсы, неактивные кнопки, поле поиска
        separator: v('--app-separator'),
        label: {
          DEFAULT: v('--app-label'),   // основной текст
          secondary: v('--app-label-2'),
          tertiary: v('--app-label-3'),
        },
        // Бренд Tickety — фиксированный, не зависит от темы Telegram
        brand: {
          DEFAULT: v('--app-brand'),   // #0058BC — CTA «Оплатить», «Применить»
          soft: v('--app-brand-soft'), // #D8E2FF — подложка «Выбрать места», иконок
          ink: v('--app-brand-ink'),   // #004493 — текст на brand-soft
        },
        success: {
          DEFAULT: v('--app-success'),     // #006E28 — «Проверен ИИ», тоглы
          soft: v('--app-success-soft'),   // #E8F8EE
          mint: '#72FE88',                 // акцент «Гарантия безопасности»
          ink: v('--app-success-ink'),     // #002107
        },
        danger: { DEFAULT: '#C8261E', soft: '#FDE7E5' }, // «Осталось N билетов», таймер брони
        warning: '#FF9500',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"',
          'system-ui', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
      },
      // Типографическая шкала iOS (Human Interface Guidelines)
      fontSize: {
        'large-title': ['34px', { lineHeight: '41px', letterSpacing: '0.37px', fontWeight: '700' }],
        title1: ['28px', { lineHeight: '34px', letterSpacing: '0.36px', fontWeight: '700' }],
        title2: ['22px', { lineHeight: '28px', letterSpacing: '0.35px', fontWeight: '700' }],
        title3: ['20px', { lineHeight: '25px', letterSpacing: '0.38px', fontWeight: '600' }],
        headline: ['17px', { lineHeight: '22px', letterSpacing: '-0.41px', fontWeight: '600' }],
        body: ['17px', { lineHeight: '22px', letterSpacing: '-0.41px' }],
        callout: ['16px', { lineHeight: '21px', letterSpacing: '-0.32px' }],
        subhead: ['15px', { lineHeight: '20px', letterSpacing: '-0.24px' }],
        footnote: ['13px', { lineHeight: '18px', letterSpacing: '-0.08px' }],
        caption1: ['12px', { lineHeight: '16px' }],
        caption2: ['11px', { lineHeight: '13px', letterSpacing: '0.07px' }],
      },
      borderRadius: {
        chip: '999px',
        '2.5xl': '20px', // карточки событий
        '4xl': '32px',   // верх bottom sheet
      },
      spacing: {
        gutter: '16px',
        'safe-t': 'var(--app-safe-top)',
        'safe-b': 'var(--app-safe-bottom)',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.04)',
        sheet: '0 -8px 32px rgb(0 0 0 / 0.12)',
        cta: '0 6px 20px rgb(11 87 194 / 0.28)',
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)', // кривая системных шторок iOS
      },
      keyframes: {
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'sheet-in': 'sheet-in 420ms cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fade-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};
