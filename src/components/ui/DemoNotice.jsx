import Icon from '@/components/icons/Icon';
import { DEMO_MODE } from '@/data/mockData';

// Плашка демо-режима: без сервера события, лоты и продавцы выдуманы, а оплата — имитация.
// Показывается везде, где пользователь мог бы принять демо за настоящее.
export default function DemoNotice({ children, className = '' }) {
  if (!DEMO_MODE) return null;
  return (
    <aside className={`flex items-start gap-3 rounded-2xl bg-[#FFF4E5] p-3 text-[#8A4B00] ${className}`}>
      <Icon name="tune" className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="text-footnote">
        <b>Демо-версия.</b> {children ?? 'События, объявления и продавцы выдуманы — купить или продать по-настоящему здесь нельзя.'}
      </p>
    </aside>
  );
}
