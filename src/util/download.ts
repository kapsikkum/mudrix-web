import { isTauri, saveDesktopDownload } from '@/util/desktop';

/**
 * Saves the file at `url` (a blob: or http(s) URL) as `filename`. In the desktop and mobile
 * shells, where webview `<a download>` does nothing, it goes to the Downloads folder and
 * resolves with the saved path. In a browser it starts a normal download and resolves `null`.
 * The caller owns `url` and revokes it, a little later for a browser download.
 */
export async function saveFile(url: string, filename: string): Promise<string | null> {
  if (isTauri()) return saveDesktopDownload(url, filename);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return null;
}

/** Like `saveFile`, for in-memory data: makes the object URL and revokes it once the save has had time to start. */
export async function saveBlob(blob: Blob, filename: string): Promise<string | null> {
  const url = URL.createObjectURL(blob);
  try {
    return await saveFile(url, filename);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
