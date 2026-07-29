import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { AuditPage } from './pages/AuditPage';
import { CoursesPage } from './pages/CoursesPage';
import { InsightsPage } from './pages/InsightsPage';
import { MistakesPage } from './pages/MistakesPage';
import { PapersPage } from './pages/PapersPage';
import { PracticePage } from './pages/PracticePage';
import { RecallPage } from './pages/RecallPage';
import { TodayPage } from './pages/TodayPage';

const ROUTES = {
  '/': TodayPage,
  '/courses': CoursesPage,
  '/recall': RecallPage,
  '/practice': PracticePage,
  '/mistakes': MistakesPage,
  '/papers': PapersPage,
  '/audit': AuditPage,
  '/insights': InsightsPage,
} as const;

type RoutePath = keyof typeof ROUTES;

function readHashPath(): RoutePath {
  const decoded = (() => {
    try {
      return decodeURIComponent(window.location.hash.slice(1).split('?')[0] || '/');
    } catch {
      return '/';
    }
  })();
  const candidate = `/${decoded}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  return candidate in ROUTES ? candidate as RoutePath : '/';
}

export default function App() {
  const [path, setPath] = useState<RoutePath>(readHashPath);
  useEffect(() => {
    const onHashChange = () => setPath(readHashPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  const Page = ROUTES[path];
  return <AppShell currentPath={path}><Page /></AppShell>;
}
