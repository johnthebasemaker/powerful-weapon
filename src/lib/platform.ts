// Central platform detection + a safe accessor for the Electron IPC bridge.
//
// The renderer historically assumed `window.api` (exposed by electron/preload.ts)
// always exists. On Android/iOS under Capacitor there is NO preload and NO
// Electron main process, so `window.api` is undefined and every page that calls
// it throws on mount. This module is the single place that answers
// "where are we running?" and "is the desktop backend actually available?".

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
};

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

/** True when running inside a Capacitor native shell (Android or iOS). */
export function isNative(): boolean {
  return window.Capacitor?.isNativePlatform?.() ?? false;
}

/** 'android' | 'ios' | 'electron' | 'web' */
export function getPlatform(): 'android' | 'ios' | 'electron' | 'web' {
  const cap = window.Capacitor?.getPlatform?.();
  if (cap === 'android' || cap === 'ios') return cap;
  if (typeof window.api !== 'undefined') return 'electron';
  return 'web';
}

/** True only when the Electron IPC bridge (window.api) is present and usable. */
export function hasDesktopBridge(): boolean {
  return typeof window.api !== 'undefined' && window.api !== null;
}

export const isAndroid = () => getPlatform() === 'android';
export const isDesktop = () => getPlatform() === 'electron';

/**
 * Safe accessor for the desktop IPC bridge. Returns null off-desktop instead of
 * letting `window.api.<x>` throw a TypeError. Callers MUST handle null — that is
 * the seam where the mobile data layer plugs in.
 *
 *   const api = getApi();
 *   if (!api) return loadFromMobileBackend();   // <-- decision-gated (see below)
 *   const users = await api.users.list();
 */
export function getApi(): Window['api'] | null {
  return hasDesktopBridge() ? window.api : null;
}
