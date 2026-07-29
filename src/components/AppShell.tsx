import {
  BarChart3,
  BookOpen,
  BookOpenCheck,
  Brain,
  CalendarCheck2,
  ChevronRight,
  ClipboardCheck,
  Cloud,
  CloudOff,
  Database,
  FileSearch,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useStudy } from '../state/StudyProvider';
import { AuthDialog } from './AuthDialog';
import { HashLink } from './HashLink';

const NAVIGATION = [
  { to: '/', label: '今日执行', icon: CalendarCheck2 },
  { to: '/courses', label: '课程地图', icon: BookOpenCheck },
  { to: '/recall', label: '政治抽背', icon: Brain },
  { to: '/practice', label: '练题中心', icon: ClipboardCheck },
  { to: '/mistakes', label: '错题复盘', icon: RotateCcw },
  { to: '/papers', label: '真题训练', icon: FileSearch },
  { to: '/audit', label: '资料审计', icon: ShieldCheck },
  { to: '/insights', label: '数据趋势', icon: BarChart3 },
] as const;

function formatDate() {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());
}

function differenceInDays(from: string) {
  const start = new Date(`${from}T00:00:00`);
  const now = new Date();
  return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
}

function focusMain(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  document.getElementById('main-content')?.focus({ preventScroll: false });
}

export function AppShell({ currentPath, children }: { currentPath: string; children: ReactNode }) {
  const { state, user, cloudStatus, cloudMessage, supabaseConfigured } = useStudy();
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('politics-lab-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const day = Math.min(120, differenceInDays(state.startedOn));

  useEffect(() => {
    try {
      localStorage.setItem('politics-lab-sidebar-collapsed', String(sidebarCollapsed));
    } catch {
      // Layout preference is optional; study data persistence is handled separately.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    mobileCloseRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const syncTitle = user
    ? cloudStatus === 'synced' ? '已同步' : cloudStatus === 'connecting' ? '正在同步' : cloudStatus === 'error' ? '同步异常' : '云端账号'
    : supabaseConfigured ? '连接 Supabase' : '本机模式';
  const syncDetail = user?.email || (supabaseConfigured ? cloudMessage : '当前设备安全保存');
  const SyncIcon = user && cloudStatus === 'synced' ? Cloud : supabaseConfigured ? Database : CloudOff;

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-is-collapsed' : ''}`}>
      <a className="skip-link" href={`#${currentPath}`} onClick={focusMain}>跳到主要内容</a>

      <aside className="sidebar" aria-label="研政侧栏">
        <div className="sidebar-heading">
          <div className="brand-block" aria-label="研政 MTI 政治学习">
            <span className="brand-mark"><BookOpen aria-hidden="true" /></span>
            <span className="brand-copy"><strong>研政</strong><small>MTI 政治学习</small></span>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
            aria-pressed={sidebarCollapsed}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </button>
        </div>

        <nav className="desktop-nav" aria-label="主导航">
          {NAVIGATION.map(({ to, label, icon: Icon }) => (
            <HashLink
              key={to}
              to={to}
              title={sidebarCollapsed ? label : undefined}
              aria-current={currentPath === to ? 'page' : undefined}
              className={`nav-link${currentPath === to ? ' is-active' : ''}`}
            >
              <Icon aria-hidden="true" /><span>{label}</span>
            </HashLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="plan-compact" title={`第 ${day} 天 / 120 天计划`}>
            <CalendarCheck2 aria-hidden="true" />
            <span><b>第 {day} 天</b><small>120 天学习计划</small></span>
          </div>
          <button className={`sync-control sync-control--${cloudStatus}`} type="button" onClick={() => setAuthOpen(true)}>
            <SyncIcon aria-hidden="true" />
            <span><b>{syncTitle}</b><small>{syncDetail}</small></span>
          </button>
        </div>
      </aside>

      <div className="content-column">
        <header className="mobile-header">
          <div className="brand-compact" aria-label="研政">
            <span className="brand-mark"><BookOpen aria-hidden="true" /></span><strong>研政</strong>
          </div>
          <button className="mobile-menu-button" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="打开菜单" aria-expanded={mobileMenuOpen}>
            <Menu aria-hidden="true" />
          </button>
        </header>

        <main id="main-content" tabIndex={-1}>
          <div className="page-meta"><span>{formatDate()}</span><b>第 <em>{day}</em> 天 · 120 天计划</b></div>
          {children}
        </main>
        <footer className="site-footer"><span>研政 · MTI 政治学习</span><span>看课 → 做题 → 输出 → 复盘</span></footer>
      </div>

      {mobileMenuOpen ? (
        <div className="mobile-menu-layer" role="presentation">
          <section className="mobile-menu-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title">
            <header>
              <div className="brand-compact" id="mobile-menu-title"><span className="brand-mark"><BookOpen aria-hidden="true" /></span><strong>研政</strong></div>
              <button ref={mobileCloseRef} className="mobile-menu-button" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="关闭菜单"><X aria-hidden="true" /></button>
            </header>
            <nav aria-label="手机主导航">
              {NAVIGATION.map(({ to, label, icon: Icon }) => (
                <HashLink key={to} to={to} aria-current={currentPath === to ? 'page' : undefined} className={`mobile-menu-link${currentPath === to ? ' is-active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <Icon aria-hidden="true" /><span>{label}</span><ChevronRight aria-hidden="true" />
                </HashLink>
              ))}
            </nav>
            <div className="mobile-menu-sync">
              <button className="sync-control" type="button" onClick={() => { setMobileMenuOpen(false); setAuthOpen(true); }}>
                <SyncIcon aria-hidden="true" /><span><b>{syncTitle}</b><small>{syncDetail}</small></span><ChevronRight aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
