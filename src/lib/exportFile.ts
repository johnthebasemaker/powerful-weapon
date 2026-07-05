// Save a text file in a platform-appropriate way (task 4).
//   Desktop/web → Blob download.
//   Android/iOS → write to cache, then hand the user the system Share sheet
//                 (a webview <a download> silently no-ops on Android).

import { getPlatform } from './platform';

export async function saveTextFile(
  filename: string,
  content: string,
  mime = 'text/plain',
): Promise<void> {
  const platform = getPlatform();

  if (platform === 'android' || platform === 'ios') {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: filename, url: uri });
    return;
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
