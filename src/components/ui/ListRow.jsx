import Icon from '@/components/icons/Icon';

// Строка iOS grouped-таблицы: цветная плитка-иконка, заголовок, подпись, аксессуар справа.
// С onClick — кнопка со стрелкой; без — статичная строка (например, с переключателем).
export default function ListRow({ icon, iconClass = 'bg-brand-soft text-brand', title, subtitle, accessory, onClick, danger }) {
  const content = (
    <>
      {icon && (
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${iconClass}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-body ${danger ? 'text-danger' : ''}`}>{title}</span>
        {subtitle && <span className="block truncate text-footnote text-label-secondary">{subtitle}</span>}
      </span>
      {accessory}
      {onClick && !accessory && <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-label-tertiary" />}
    </>
  );

  const box = 'flex w-full items-center gap-3 px-4 py-3 text-left';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${box} transition-colors active:bg-fill/60`}>
      {content}
    </button>
  ) : (
    <div className={box}>{content}</div>
  );
}
