// Unified data-access facade. Pages import `api()` instead of touching
// `window.api` directly, so the same UI runs on desktop (Electron IPC) and
// Android (on-device SQLite) without per-page platform branches.

import { hasDesktopBridge } from './platform';
import { mobileApi } from './db/mobileApi';

/**
 * Returns the platform's data API:
 *   - Desktop/web with the Electron bridge → window.api (unchanged behaviour).
 *   - Android/iOS → the on-device SQLite implementation.
 */
export function api(): Window['api'] {
  return hasDesktopBridge() ? window.api : mobileApi;
}
