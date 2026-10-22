import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTelegramBackButton } from './hooks/useTelegramBackButton';
import { refreshEvents } from './data/eventsStore';
import { refreshListings } from './data/listingsStore';
import TabBar from './components/layout/TabBar';
import HomePage from './pages/HomePage';
import EventPage from './pages/EventPage';
import CheckoutPage from './pages/CheckoutPage';
import TicketsPage from './pages/TicketsPage';
import TicketPage from './pages/TicketPage';
import ProfilePage from './pages/ProfilePage';
import SellPage from './pages/SellPage';
import SellWizardPage from './pages/SellWizardPage';
import AdminPage from './pages/admin/AdminPage';
import AdminEventPage from './pages/admin/AdminEventPage';
import AdminThreadPage from './pages/admin/AdminThreadPage';
import { SupportListPage, SupportNewPage, SupportThreadPage } from './pages/SupportPage';

// Экраны со своей кнопкой действия внизу — таб-бар бы её перекрывал
const NO_TAB_BAR = ['/checkout', '/sell/new', '/admin/events/', '/admin/support/', '/support/'];

export default function App() {
  useTelegramBackButton();
  const { pathname } = useLocation();
  const withTabBar = !NO_TAB_BAR.some((p) => pathname.startsWith(p));

  // События и объявления с сервера — один раз при запуске (без сервера ничего не делает)
  useEffect(() => {
    refreshEvents();
    refreshListings();
  }, []);

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
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:id" element={<TicketPage />} />
        <Route path="/sell" element={<SellPage />} />
        <Route path="/sell/new" element={<SellWizardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/events/:id" element={<AdminEventPage />} />
        <Route path="/admin/support/:id" element={<AdminThreadPage />} />
        <Route path="/support" element={<SupportListPage />} />
        <Route path="/support/new" element={<SupportNewPage />} />
        <Route path="/support/:id" element={<SupportThreadPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {withTabBar && <TabBar />}
    </div>
  );
}
