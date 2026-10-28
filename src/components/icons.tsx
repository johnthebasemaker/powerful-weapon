// Line icons (24px grid, 1.8 stroke) used by the tab bar and screens.
import { ReactNode } from 'react';

function I({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export const IconHome = () => <I><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></I>;
export const IconBook = () => <I><path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z" /><path d="M12 6.5v13" /></I>;
export const IconMic = () => <I><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></I>;
export const IconTrophy = () => <I><path d="M8 4h8v5a4 4 0 01-8 0V4z" /><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 21h8M9.5 17h5" /></I>;
export const IconMore = () => <I><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></I>;
export const IconCalendar = () => <I><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></I>;
export const IconSettings = () => <I><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></I>;
export const IconUsers = () => <I><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.6a3.5 3.5 0 010 6.8M18 14.2a6.5 6.5 0 013.5 5.8" /></I>;
export const IconShare = () => <I><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></I>;
export const IconCopy = () => <I><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h8" /></I>;
export const IconRefresh = () => <I><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" /></I>;
export const IconBell = () => <I><path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 20a2 2 0 004 0" /></I>;
export const IconSend = () => <I><path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" /></I>;
export const IconCheck = () => <I><path d="M5 12.5l4.5 4.5L19 7.5" /></I>;
export const IconStar = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
  </svg>
);
export const IconSearch = () => <I><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></I>;
export const IconUpload = () => <I><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></I>;
export const IconBattery = () => <I><rect x="2.5" y="7" width="17" height="10" rx="2" /><path d="M22 10.5v3M6 10v4M9.5 10v4" /></I>;
export const IconShield = () => <I><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" /></I>;
export const IconChevronLeft = () => <I><path d="M15 6l-6 6 6 6" /></I>;
export const IconChevronRight = () => <I><path d="M9 6l6 6-6 6" /></I>;
export const IconBrain = () => <I><path d="M9 4a3 3 0 00-3 3v.3A3 3 0 004 10a3 3 0 001 2.2A3.5 3.5 0 006.5 18H9V4zM15 4a3 3 0 013 3v.3A3 3 0 0120 10a3 3 0 01-1 2.2A3.5 3.5 0 0117.5 18H15V4z" /><path d="M9 18v2M15 18v2M9 9H7.5M15 9h1.5M9 13.5H7M15 13.5h2" /></I>;
export const IconTrash = () => <I size={18}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></I>;
