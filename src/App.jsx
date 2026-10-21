import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTelegramBackButton } from './hooks/useTelegramBackButton';
import TabBar from './components/layout/TabBar';
import TopBar from './components/layout/TopBar';
import HomePage from './pages/HomePage';
import EventPage from './pages/EventPage';
import CheckoutPage from './pages/CheckoutPage';

// Разделы вне MVP — заглушки, чтобы таб-бар был живым
const Placeholder = ({ title }) => (
  <>
    <TopBar title={title} />
    <div className="px-gutter pt-4">
      <div className="card p-6 text-center text-subhead text-label-secondary">Раздел появится в следующей версии</div>
    </div>
  </>
);

export default function App() {
  useTelegramBackButton();
  const { pathname } = useLocation();
  const withTabBar = !pathname.startsWith('/checkout');

  // Новый экран открывается с начала, как push в UINavigationController
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={withTabBar ? 'min-h-full pb-[calc(64px+var(--app-safe-bottom))]' : 'min-h-full'}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/event/:id" element={<EventPage />} />
        <Route path="/checkout/:offerId" element={<CheckoutPage />} />
        <Route path="/tickets" element={<Placeholder title="Мои билеты" />} />
        <Route path="/sell" element={<Placeholder title="Продать" />} />
        <Route path="/profile" element={<Placeholder title="Профиль" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {withTabBar && <TabBar />}
    </div>
  );
}
