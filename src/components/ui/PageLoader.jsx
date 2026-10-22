// Каталог ещё грузится с сервера — не делаем поспешный вывод «события нет»
export default function PageLoader({ label = 'Загружаем…' }) {
  return (
    <p className="flex items-center justify-center gap-2 px-gutter py-16 text-subhead text-label-secondary">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </p>
  );
}
