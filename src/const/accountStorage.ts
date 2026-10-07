import { STORAGE_KEY_CREDENTIALS } from './storageKeys';

function readUserIdFromStorage(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CREDENTIALS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: unknown };
    return typeof parsed?.userId === 'string' ? parsed.userId : null;
  } catch {
    return null;
  }
}

let currentUserId: string | null = readUserIdFromStorage();

const listeners = new Set<() => void>();

export function getStoredUserId(): string | null {
  return currentUserId;
}

export function setStoredUserId(userId: string | null): void {
  if (currentUserId === userId) return;
  currentUserId = userId;
  listeners.forEach((listener) => listener());
}

export function subscribeStoredUserId(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const ANONYMOUS_SCOPE = '__anon__';

export function accountStorageKey(baseKey: string): string {
  return `${baseKey}::${currentUserId ?? ANONYMOUS_SCOPE}`;
}
