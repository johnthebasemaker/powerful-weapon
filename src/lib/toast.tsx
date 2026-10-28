// Minimal dependency-free toast + a network-error wrapper.
//
// Task 5: when a mobile device drops connectivity, calls should fail with a
// graceful "Network connection lost" message instead of an unhandled rejection
// that freezes the UI. This is a self-contained imperative toast (no provider,
// no context) so it works from anywhere — event handlers, effects, catch blocks.

let container: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (container) return container;
  container = document.createElement('div');
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  container.style.cssText = [
    'position:fixed',
    'left:50%',
    'transform:translateX(-50%)',
    // sit above the bottom tab bar + Android nav bar / iOS home indicator
    'bottom:calc(5.75rem + env(safe-area-inset-bottom))',
    'z-index:9999',
    'display:flex',
    'flex-direction:column',
    'gap:0.5rem',
    'pointer-events:none',
    'width:min(90vw,28rem)',
  ].join(';');
  document.body.appendChild(container);
  return container;
}

export type ToastKind = 'info' | 'error' | 'success';

export function toast(message: string, kind: ToastKind = 'info', ms = 3500): void {
  const root = ensureContainer();
  const el = document.createElement('div');
  const bg = kind === 'error' ? '#b42318' : kind === 'success' ? '#18614f' : '#0b2421';
  el.style.cssText = [
    `background:${bg}`,
    'color:#fff',
    'padding:0.625rem 0.875rem',
    'border-radius:0.625rem',
    'font-size:0.875rem',
    'line-height:1.3',
    'box-shadow:0 6px 20px rgba(0,0,0,0.18)',
    'opacity:0',
    'transition:opacity 160ms ease',
    'text-align:center',
  ].join(';');
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  window.setTimeout(() => {
    el.style.opacity = '0';
    window.setTimeout(() => el.remove(), 200);
  }, ms);
}

/** Heuristic: does this rejection look like a lost/failed network connection? */
function looksLikeNetworkError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('econn') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  );
}

/**
 * Wrap any async call so a dropped connection surfaces a toast and resolves to a
 * fallback instead of throwing. Use at call sites that hit the network / backend:
 *
 *   const users = await safeCall(() => api.users.list(), [], 'Couldn't load users');
 */
export async function safeCall<T>(
  fn: () => Promise<T>,
  fallback: T,
  label = 'Something went wrong',
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (looksLikeNetworkError(err)) {
      toast('Network connection lost — check your data or Wi-Fi.', 'error');
    } else {
      toast(label, 'error');
    }
    // eslint-disable-next-line no-console
    console.error(label, err);
    return fallback;
  }
}
