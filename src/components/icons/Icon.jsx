// Все SVG из src/assets/icons/{mono,color} автоматически становятся React-компонентами
// (SVGR + SVGO, см. vite.config.js). Достаточно положить файл в папку.
//   <Icon name="knopka_calendar" className="h-4 w-4 text-label-secondary" />
const modules = import.meta.glob('../../assets/icons/{mono,color}/*.svg', {
  query: '?react',
  import: 'default',
  eager: true,
});

export const icons = Object.fromEntries(
  Object.entries(modules).map(([path, Component]) => [
    path.split('/').pop().replace(/\.svg$/, ''),
    Component,
  ]),
);

export default function Icon({ name, className = 'h-5 w-5', ...props }) {
  const Svg = icons[name];
  if (!Svg) {
    if (import.meta.env.DEV) console.warn(`[Icon] нет файла src/assets/icons/{mono,color}/${name}.svg`);
    return <span className={`inline-block ${className}`} aria-hidden />;
  }
  return <Svg className={className} aria-hidden focusable="false" {...props} />;
}
