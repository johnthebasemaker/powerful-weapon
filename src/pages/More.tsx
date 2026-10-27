import { useNavigate } from 'react-router-dom';
import { Card, PageHeader, Row } from '../components/ui';
import { IconSettings, IconUsers } from '../components/icons';

/** Phone-only overflow menu behind the 5th tab (desktop shows these in the sidebar). */
export default function More() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <PageHeader title="More" />
      <Card pad={false} className="divide-y divide-gray-100 overflow-hidden">
        <Row icon={<IconUsers />} title="Members" subtitle="Add, import and manage group members" onClick={() => navigate('/users')} />
        <Row icon={<IconSettings />} title="Settings" subtitle="Send time, members' phones, notifications, grading, backup" onClick={() => navigate('/settings')} />
      </Card>
      <div className="rounded-3xl overflow-hidden bg-black">
        <img src="brand/poster.jpg" alt="The most powerful weapon in the world is the Word of God." className="w-full max-w-sm mx-auto" />
      </div>
    </div>
  );
}
