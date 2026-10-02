export function formatTime(ts: number, locale?: string): string {
  return new Date(ts).toLocaleTimeString(locale ? [locale] : [], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateLabel(ts: number, t: (key: string) => string, locale?: string): string {
  const date = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (d === today) return t('timeline.dateToday');
  if (d === yesterday) return t('timeline.dateYesterday');
  return date.toLocaleDateString(locale ? [locale] : [], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${seconds}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
