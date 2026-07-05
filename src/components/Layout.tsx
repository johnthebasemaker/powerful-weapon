import { NavLink } from 'react-router-dom';
import { ReactNode, useState } from 'react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/verses', label: 'Verse Picker', icon: '📖' },
  { to: '/users', label: 'Users', icon: '👥' },
  { to: '/voice-inbox', label: 'Voice Inbox', icon: '🎙️' },
  { to: '/leaderboards', label: 'Leaderboards', icon: '🏆' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
              isActive ? 'bg-brand-100 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
            }`
          }
        >
          <span className="text-base">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen bg-brand-50">
      {/* Desktop sidebar (unchanged) */}
      <aside className="hidden md:flex w-60 bg-white border-r border-gray-200 flex-col safe-top safe-x">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-lg font-semibold text-brand-700">Powerful Weapon</div>
          <div className="text-xs text-gray-500">Tamil Bible Study</div>
        </div>
        <NavList />
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
          v0.1.1 · For non-commercial use
        </div>
      </aside>

      {/* Mobile slide-in drawer + scrim */}
      <div className={`md:hidden fixed inset-0 z-40 ${drawerOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-72 max-w-[82%] bg-white shadow-xl flex flex-col safe-top safe-x transition-transform duration-200 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-brand-700">Powerful Weapon</div>
              <div className="text-xs text-gray-500">Tamil Bible Study</div>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="p-2 -mr-2 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
          </div>
          <NavList onNavigate={() => setDrawerOpen(false)} />
        </aside>
      </div>

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top app bar with hamburger */}
        <header className="md:hidden bg-white border-b border-gray-200 safe-top safe-x flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="p-2 -ml-2 rounded-md hover:bg-gray-100 text-gray-700"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="text-base font-semibold text-brand-700 leading-tight truncate">Powerful Weapon</div>
            <div className="text-[11px] text-gray-500 leading-tight">Tamil Bible Study</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto safe-x safe-bottom">
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-4 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
