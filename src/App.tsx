import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VersePicker from './pages/VersePicker';
import Users from './pages/Users';
import VoiceInbox from './pages/VoiceInbox';
import Leaderboards from './pages/Leaderboards';
import Settings from './pages/Settings';
import More from './pages/More';
import Today from './pages/Today';
import Practice from './pages/Practice';
import Record from './pages/Record';
import Group from './pages/Group';
import Welcome from './pages/Welcome';
import { useAndroidBackButton } from './lib/useAndroidBackButton';
import { useShareIntent } from './lib/shareIntent';
import { useNotifications } from './lib/scheduler';
import { RoleProvider, useRole } from './lib/role';

function Shell() {
  const { role, ready, memberAuthed } = useRole();
  useAndroidBackButton(); // Android hardware back button → router history / clean exit
  useShareIntent();       // WhatsApp "Share → Powerful Weapon" → Voice Inbox
  useNotifications();     // daily verse notifications: schedule on launch/resume + tap → screen

  if (!ready) return <div className="h-screen bg-brand-900" />;
  if (role === null) return <Welcome />;
  if (role === 'member' && !memberAuthed) return <Welcome initial="member" />;

  const home = role === 'member' ? '/today' : '/dashboard';
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={home} replace />} />
        {role === 'member' ? (
          <>
            <Route path="/today" element={<Today />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/record" element={<Record />} />
            <Route path="/group" element={<Group />} />
            <Route path="/settings" element={<Settings />} />
          </>
        ) : (
          <>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/verses" element={<VersePicker />} />
            <Route path="/users" element={<Users />} />
            <Route path="/voice-inbox" element={<VoiceInbox />} />
            <Route path="/leaderboards" element={<Leaderboards />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/more" element={<More />} />
          </>
        )}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <Shell />
    </RoleProvider>
  );
}
