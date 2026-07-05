import { Clipboard } from '@capacitor/clipboard';
import { AppLauncher } from '@capacitor/app-launcher';
import { getApi } from './platform';

/**
 * Semi-manual daily verse posting (group-preserving — see ANDROID_PORT_PLAN §1a).
 *
 * Desktop: reuse the existing Electron IPC (clipboard + open WhatsApp Web).
 * Android: copy the verse, then open WhatsApp with the text pre-filled so the
 * admin just picks the group and taps Send. WhatsApp cannot be targeted at a
 * specific group programmatically — that is a platform limit, not a bug.
 *
 * NOTE (Android 11+): to let AppLauncher.canOpenUrl see WhatsApp, add to
 * android/app/src/main/AndroidManifest.xml:
 *   <queries><package android:name="com.whatsapp"/></queries>
 */
export async function postVerseToWhatsApp(message: string): Promise<void> {
  const api = getApi();
  if (api) {
    await api.whatsapp.copyMessage(message);
    await api.whatsapp.openWeb();
    return;
  }

  await Clipboard.write({ string: message }); // fallback: long-press → Paste
  const encoded = encodeURIComponent(message);
  const { value: hasWhatsApp } = await AppLauncher.canOpenUrl({ url: 'whatsapp://send' });
  await AppLauncher.openUrl({
    url: hasWhatsApp ? `whatsapp://send?text=${encoded}` : `https://wa.me?text=${encoded}`,
  });
}
