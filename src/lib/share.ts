import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import { isNative } from './platform';
import { toast } from './toast';

export function verseMessage(v: { book: string; chapter: number; verse: number; text: string }, dateLabel?: string): string {
  return [
    'இன்றைய ரேமா (வார்த்தை)',
    ...(dateLabel ? [`(${dateLabel})`] : []),
    '',
    `*${v.book} ${v.chapter}:${v.verse}*`,
    `*${v.text}*`,
  ].join('\n');
}

export async function copyText(text: string): Promise<void> {
  try {
    if (isNative()) await Clipboard.write({ string: text });
    else await navigator.clipboard.writeText(text);
    toast('Copied', 'success', 1800);
  } catch {
    toast('Could not copy', 'error');
  }
}

/** System share sheet (WhatsApp, SMS, …); falls back to copying. */
export async function shareText(text: string): Promise<void> {
  try {
    if (isNative()) { await Share.share({ text }); return; }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch {
    return; // user dismissed the sheet
  }
  await copyText(text);
}
