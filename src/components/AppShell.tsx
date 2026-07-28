import {
  BarChart3,
  BookOpenCheck,
  CalendarCheck2,
  ChevronRight,
  ClipboardCheck,
  Cloud,
  CloudOff,
  FileSearch,
  FolderSearch2,
  Menu,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStudy } from '../state/StudyProvider';
import { AuthDialog } from './AuthDialog';
import { HashLink } from './HashLink';

const NAVIGATION = [
  { to: '/', label: '今日执行', short: '今日', icon: CalendarCheck2 },
  { to: '/courses', label: '课程地图', short: '课程', icon: BookOpenCheck },
  { to: '/practice', label: '练题中心', short: '练题', icon: ClipboardCheck },
  { to: '/mistakes', label: '错题复盘', short: '错题', icon: RotateCcw },
  { to: '/papers', label: '真题训练', short: '真题', icon: FileSearch },
  { to: '/audit', label: '资料审计', short: '审计', icon: ShieldCheck },
  { to: '/insights', label: '数据趋势', short: '数据', icon: BarChart3 },
] as const;

const MOBILE_PRIMARY = new Set(['/', '/courses', '/practice', '/mistakes']);

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

export function AppShell({ currentPath, children }: { currentPath: string; children: ReactNode }) {
  const { state, user, cloudStatus, cloudMessage } = useStudy();
  const [authOpen, setAuthOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreCloseRef = useRef<HTMLButtonElement>(null);
  const day = Math.min(120, differenceInDays(state.startedOn));

  useEffect(() => {
    if (!moreOpen) return;
    moreCloseRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const mobileIsMore = !MOBILE_PRIMARY.has(currentPath);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar">
        <div className="brand-block" aria-label="研政 Politics Lab">
          <strong>研政</strong><span>POLITICS LAB</span><i>研</i>
        </div>
        <nav className="desktop-nav" aria-label="主导航">
          {NAVIGATION.map(({ to, label, icon: Icon }) => (
            <HashLink key={to} to={to} aria-current={currentPath === to ? 'page' : undefined} className={`nav-link${currentPath === to ? ' is-active' : ''}`}>
              <Icon aria-hidden="true" /><span>{label}</span><ChevronRight className="nav-arrow" aria-hidden="true" />
            </HashLink>
          ))}
        </nav>
        <div className="sidebar-plan">
          <span>考研政治 · 120 天计划</span>
          <strong>{day}<small> / 120 天</small></strong>
          <div className="thin-progress"><i style={{ width: `${(day / 120) * 100}%` }} /></div>
          <p>第 {day} 天 · 今天只做三件事</p>
        </div>
        <button className="cloud-button" type="button" onClick={() => setAuthOpen(true)}>
          {user ? <Cloud aria-hidden="true" /> : <CloudOff aria-hidden="true" />}
          <span><b>{user ? '云同步已登录' : '仅本机保存'}</b><small>{user?.email || cloudMessage}</small></span>
        </button>
      </aside>

      <div className="content-column">
        <header className="mobile-header">
          <div className="brand-compact"><strong>研政</strong><span>POLITICS LAB</span></div>
          <button className="icon-button" type="button" onClick={() => setAuthOpen(true)} aria-label="云同步">
            {cloudStatus === 'synced' ? <Cloud /> : <CloudOff />}
          </button>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-meta"><span>{formatDate()}</span><b>第 <em>{day}</em> 天 / 120 天</b></div>
          {children}
        </main>
        <footer className="site-footer"><span>方法 &gt; 努力</span><span>输入 → 理解 → 输出 → 复盘</span><span>研政 / POLITICS LAB</span></footer>
      </div>

      <nav className="mobile-nav" aria-label="手机主导航">
        {NAVIGATION.filter((item) => MOBILE_PRIMARY.has(item.to)).map(({ to, short, icon: Icon }) => (
          <HashLink key={to} to={to} aria-current={currentPath === to ? 'page' : undefined} className={`mobile-nav-link${currentPath === to ? ' is-active' : ''}`}>
            <Icon aria-hidden="true" /><span>{short}</span>
          </HashLink>
        ))}
        <button className={`mobile-nav-link${mobileIsMore ? ' is-active' : ''}`} type="button" onClick={() => setMoreOpen(true)}>
          <Menu aria-hidden="true" /><span>更多</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className="dialog-layer" role="presentation">
          <button className="dialog-scrim" type="button" aria-label="关闭更多导航" onClick={() => setMoreOpen(false)} />
          <section className="more-sheet" role="dialog" aria-modal="true" aria-labelledby="more-title">
            <div className="sheet-heading"><div><span>ALL MODULES</span><h2 id="more-title">更多</h2></div><button ref={moreCloseRef} className="icon-button" type="button" onClick={() => setMoreOpen(false)} aria-label="关闭"><X /></button></div>
            <div className="more-grid">
              {NAVIGATION.filter((item) => !MOBILE_PRIMARY.has(item.to)).map(({ to, label, icon: Icon }) => (
                <HashLink key={to} to={to} className="more-link" onClick={() => setMoreOpen(false)}><Icon aria-hidden="true" /><span>{label}</span><ChevronRight aria-hidden="true" /></HashLink>
              ))}
              <button className="more-link" type="button" onClick={() => { setMoreOpen(false); setAuthOpen(true); }}>
                <FolderSearch2 aria-hidden="true" /><span>云同步设置</span><ChevronRight aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
