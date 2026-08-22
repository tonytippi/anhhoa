import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OverviewPage, PlaceholderPage } from '../features/overview/page';
import { ClassesPage } from '../features/classes/page';
import { ClassDetailPage } from '../features/classes/detail-page';
import { StudentsPage } from '../features/students/page';
import { StudentDetailPage } from '../features/students/detail-page';
import { InvoiceTemplatePage } from '../features/invoice-template/page';
import { BankAccountsPage } from '../features/bank-accounts/page';
import { InvoicesPage } from '../features/invoices/page';
import { InvoiceDetailPage } from '../features/invoices/detail-page';
import { ReportsPage } from '../features/reports/page';
import { MenuButton } from '../components/menu-button';
import { NavigationSheet } from '../components/navigation-sheet';
import { OfflineNotice } from '../components/offline-notice';
import { Sidebar } from '../components/sidebar';
import { ApiError } from './api/client';
import { useCurrentAdmin } from './api/auth';
import { LoginPage } from '../features/auth/login-page';

export function App(): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const trigger = useRef<HTMLButtonElement>(null);
  const [queryClient] = useState(() => new QueryClient());
  const closeMenu = (): void => {
    if (!menuOpenRef.current) return;
    menuOpenRef.current = false;
    setMenuOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const closeAtDesktop = (event: MediaQueryListEvent): void => {
      setIsDesktop(event.matches);
      if (event.matches) {
        closeMenu();
      }
    };
    mediaQuery.addEventListener('change', closeAtDesktop);
    return () => mediaQuery.removeEventListener('change', closeAtDesktop);
  }, []);
  return <QueryClientProvider client={queryClient}><BrowserRouter><AuthBoundary /></BrowserRouter></QueryClientProvider>;

  function AuthBoundary(): React.JSX.Element {
    const identity = useCurrentAdmin();
    if (identity.sessionRejected || (identity.error instanceof ApiError && (identity.error.status === 401 || identity.error.status === 403))) return <LoginPage />;
    if (identity.isPending) return <main className="auth-status" aria-live="polite"><h1>Đang kiểm tra phiên</h1><p>Vui lòng chờ trong giây lát.</p></main>;
    if (identity.error) return <main className="auth-status" aria-live="assertive"><h1>Không thể kiểm tra phiên</h1><p>Vui lòng kiểm tra kết nối và thử lại.</p><button type="button" onClick={() => void identity.refetch()}>Thử lại</button></main>;
    const admin = identity.data!;
    return <div className="app-shell"><Sidebar admin={admin} /><header className="mobile-header"><MenuButton isDesktop={isDesktop} isOpen={menuOpen} onClick={() => { menuOpenRef.current = true; setMenuOpen(true); }} trigger={trigger} /><span>Ánh Hoa</span></header>{menuOpen && <NavigationSheet admin={admin} trigger={trigger} onClose={closeMenu} />}<main><Page /></main><OfflineNotice /></div>;
  }

  function Page(): React.JSX.Element { const path = useLocation().pathname; return path === '/' ? <OverviewPage /> : path === '/lop' ? <ClassesPage /> : /^\/lop\/[^/]+$/.test(path) ? <ClassDetailPage /> : path === '/hoc-sinh' ? <StudentsPage /> : /^\/hoc-sinh\/[^/]+$/.test(path) ? <StudentDetailPage /> : path === '/hoa-don' ? <InvoicesPage /> : /^\/hoa-don\/[^/]+$/.test(path) ? <InvoiceDetailPage /> : path === '/mau-hoa-don' ? <InvoiceTemplatePage /> : path === '/tai-khoan-nhan-tien' ? <BankAccountsPage /> : path === '/bao-cao' ? <ReportsPage /> : <PlaceholderPage />; }
}
