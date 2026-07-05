import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VersePicker from './pages/VersePicker';
import Users from './pages/Users';
import VoiceInbox from './pages/VoiceInbox';
import Leaderboards from './pages/Leaderboards';
import Settings from './pages/Settings';
import { useAndroidBackButton } from './lib/useAndroidBackButton';
import { useShareIntent } from './lib/shareIntent';
import { useReminderTap } from './lib/scheduler';

export default function App() {
  useAndroidBackButton(); // Android hardware back button → router history / clean exit
  useShareIntent();       // WhatsApp "Share → Powerful Weapon" → Voice Inbox
  useReminderTap();       // Tapping the daily reminder → Dashboard to post
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/verses" element={<VersePicker />} />
        <Route path="/users" element={<Users />} />
        <Route path="/voice-inbox" element={<VoiceInbox />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
