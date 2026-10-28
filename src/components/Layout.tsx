import { NavLink, useLocation } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { useRole } from '../lib/role';
import ErrorBoundary from './ErrorBoundary';
import { cx } from './ui';
import {
  IconBook, IconBrain, IconHome, IconMic, IconMore, IconSettings, IconTrophy, IconUsers,
} from './icons';

interface NavItem { to: string; label: string; icon: () => JSX.Element; match?: string[] }

// Phone: bottom tabs (thumb reach, always visible). Desktop: the same items in a sidebar.
const ADMIN_TABS: NavItem[] = [
  { to: '/dashboard', label: 'Home', icon: IconHome },
  { to: '/verses', label: 'Verses', icon: IconBook },
  { to: '/voice-inbox', label: 'Voice', icon: IconMic },
  { to: '/leaderboards', label: 'Ranks', icon: IconTrophy },
  { to: '/more', label: 'More', icon: IconMore, match: ['/more', '/users', '/settings'] },
];
const ADMIN_SIDEBAR: NavItem[] = [
  ...ADMIN_TABS.slice(0, 4),
  { to: '/users', label: 'Members', icon: IconUsers },
  { to: '/settings', label: 'Settings', icon: IconSettings },
];
// Members get a deliberately small app: study, practise, record, see who sent.
const MEMBER_TABS: NavItem[] = [
  { to: '/today', label: 'Verses', icon: IconBook },
  { to: '/practice', label: 'Practice', icon: IconBrain },
  { to: '/record', label: 'Record', icon: IconMic },
  { to: '/group', label: 'Group', icon: IconUsers },
];

const TITLES: Record<string, string> = {
  '/dashboard': 'Home', '/verses': 'Verse Picker', '/voice-inbox': 'Voice Inbox',
  '/leaderboards': 'Leaderboards', '/more': 'More', '/users': 'Members', '/settings': 'Settings',
  '/today': 'Verses', '/practice': 'Practice', '/record': 'Record', '/group': 'Group',
};

/** Hide the bottom bar while the on-screen keyboard is up (it would ride on top of it). */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const base = window.innerHeight;
    const onResize = () => setOpen(window.innerHeight < base - 150);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return open;
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <img src="brand/icon-192.png" alt="" className={cx('rounded-xl shrink-0', compact ? 'w-9 h-9' : 'w-10 h-10')} />
      <div className="min-w-0 leading-tight">
        <div className="text-[15px] font-semibold text-white truncate">Powerful Weapon</div>
        <div className="tamil text-[11px] text-gold-300 truncate" style={{ lineHeight: 1.3 }}>கர்த்தருடைய வார்த்தை</div>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { role } = useRole();
  const loc = useLocation();
  const keyboardOpen = useKeyboardOpen();
  const tabs = role === 'member' ? MEMBER_TABS : ADMIN_TABS;
  const sidebar = role === 'member' ? [...MEMBER_TABS, { to: '/settings', label: 'Settings', icon: IconSettings }] : ADMIN_SIDEBAR;
  const title = TITLES[loc.pathname] ?? '';

  // Scroll to top on tab change (the scroller is <main>, not the window).
  useEffect(() => { document.getElementById('app-main')?.scrollTo(0, 0); }, [loc.pathname]);

  return (
    <div className="flex h-screen bg-paper">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-brand-900 text-white flex-col safe-top">
        <div className="px-5 py-5 border-b border-white/10"><Brand /></div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sidebar.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition',
                isActive ? 'bg-white/10 text-white font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white',
              )}
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/40">v0.0.5 · For non-commercial use</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Phone app bar — dark, carries the logo; padded under the status bar / notch */}
        <header className="md:hidden bg-brand-900 safe-top shadow-lift z-20">
          <div className="safe-x h-14 flex items-center justify-between gap-3">
            <Brand compact />
            {role === 'member' ? (
              <NavLink to="/settings" aria-label="Settings" className="w-10 h-10 -mr-2 grid place-items-center text-white/80"><IconSettings /></NavLink>
            ) : title && <span className="text-xs text-white/60 truncate">{title}</span>}
          </div>
        </header>

        <main id="app-main" className="flex-1 overflow-y-auto">
          <div className="w-full max-w-3xl mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-tabbar md:pb-10"><ErrorBoundary resetKey={loc.pathname}>{children}</ErrorBoundary></div>
        </main>

        {/* Phone bottom tab bar */}
        {!keyboardOpen && (
          <nav className="tabbar md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-black/5 safe-bottom">
            <div className="flex">
              {tabs.map((item) => {
                const active = (item.match ?? [item.to]).includes(loc.pathname);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className="flex-1 flex flex-col items-center justify-center gap-1 h-16 min-w-0"
                  >
                    <span className={cx(
                      'h-8 w-14 rounded-full grid place-items-center transition',
                      active ? 'bg-brand-100 text-brand-800' : 'text-gray-500',
                    )}>
                      <item.icon />
                    </span>
                    <span className={cx('text-[11px] leading-none truncate', active ? 'text-brand-800 font-semibold' : 'text-gray-500')}>
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
