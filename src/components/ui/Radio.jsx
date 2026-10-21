import Icon from '@/components/icons/Icon';

// ikonka_galochka / ikonka_pustaya_bes_galochki: круг с галочкой и пустой круг
export default function Radio({ checked }) {
  return checked ? (
    <span className="grid h-6 w-6 shrink-0 animate-fade-in place-items-center rounded-full bg-brand text-white">
      <Icon name="check" className="h-6 w-6" />
    </span>
  ) : (
    <span className="h-6 w-6 shrink-0 rounded-full bg-fill" />
  );
}
