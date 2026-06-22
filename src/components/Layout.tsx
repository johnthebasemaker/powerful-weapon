import { NavLink } from 'react-router-dom';
import { ReactNode } from 'react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/verses', label: 'Verse Picker', icon: '📖' },
  { to: '/users', label: 'Users', icon: '👥' },
  { to: '/voice-inbox', label: 'Voice Inbox', icon: '🎙️' },
  { to: '/leaderboards', label: 'Leaderboards', icon: '🏆' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-brand-50">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-lg font-semibold text-brand-700">Powerful Weapon</div>
          <div className="text-xs text-gray-500">Tamil Bible Study</div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-brand-100 text-brand-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
          v0.1.0 · For non-commercial use
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
