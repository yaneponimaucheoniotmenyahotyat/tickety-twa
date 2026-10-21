import { NavLink } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import { haptic } from '@/lib/telegram';

// Глифы из knopka_*_snizu.svg; подписи — живым текстом, а не кривыми из Figma
const TABS = [
  { to: '/', label: 'Поиск', icon: 'tab-search' },
  { to: '/tickets', label: 'Мои билеты', icon: 'tab-tickets' },
  { to: '/sell', label: 'Продать', icon: 'tab-sell' },
  { to: '/profile', label: 'Профиль', icon: 'tab-profile' },
];

export default function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-separator bg-surface/85 pb-safe-b backdrop-blur-xl">
      <ul className="grid h-14 grid-cols-4">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end
              onClick={() => haptic('selection')}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-0.5 text-caption2 font-medium transition-colors ${
                  isActive ? 'text-brand' : 'text-label-secondary'
                }`
              }
            >
              <Icon name={t.icon} className="h-6 w-6" />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
