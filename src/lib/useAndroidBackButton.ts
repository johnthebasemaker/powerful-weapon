import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { isAndroid } from './platform';

/**
 * Task 2: Android hardware back button.
 * - Not on the home screen → navigate back in the router history.
 * - On the home screen (or no history) → exit the app cleanly.
 * No-op on desktop/web (guarded by isAndroid), so it is safe to always call.
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();
  const loc = useLocation();
  // Keep the latest path in a ref so we register the native listener once.
  const path = useRef(loc.pathname);
  path.current = loc.pathname;

  useEffect(() => {
    if (!isAndroid()) return;
    let handle: { remove: () => void } | undefined;
    const pending = App.addListener('backButton', ({ canGoBack }) => {
      const atRoot = path.current === '/' || path.current === '/dashboard';
      if (atRoot || !canGoBack) App.exitApp();
      else navigate(-1);
    });
    pending.then((h) => { handle = h; });
    return () => { handle?.remove(); };
  }, [navigate]);
}
