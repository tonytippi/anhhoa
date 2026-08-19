import { useEffect, useRef, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlaceholderPage } from '../features/overview/page';
import { MenuButton } from '../components/menu-button';
import { NavigationSheet } from '../components/navigation-sheet';
import { OfflineNotice } from '../components/offline-notice';
import { Sidebar } from '../components/sidebar';

export function App(): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const trigger = useRef<HTMLButtonElement>(null);
  const [queryClient] = useState(() => new QueryClient());
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const closeAtDesktop = (event: MediaQueryListEvent): void => {
      setIsDesktop(event.matches);
      if (event.matches) setMenuOpen(false);
    };
    mediaQuery.addEventListener('change', closeAtDesktop);
    return () => mediaQuery.removeEventListener('change', closeAtDesktop);
  }, []);
  return <QueryClientProvider client={queryClient}><BrowserRouter><div className="app-shell"><Sidebar /><header className="mobile-header"><MenuButton isDesktop={isDesktop} isOpen={menuOpen} onClick={() => setMenuOpen(true)} trigger={trigger} /><span>Ánh Hoa</span></header>{menuOpen && <NavigationSheet trigger={trigger} onClose={() => setMenuOpen(false)} />}<main><PlaceholderPage /></main><OfflineNotice /></div></BrowserRouter></QueryClientProvider>;
}
