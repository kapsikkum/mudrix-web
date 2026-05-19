import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export interface MatrixCredentials {
  userId: string;
  accessToken: string;
  deviceId: string;
  homeserverUrl: string;
}

export const credentialsAtom = atomWithStorage<MatrixCredentials | null>(
  'matrix-credentials',
  null,
  {
    getItem: (key, initialValue) => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : initialValue;
      } catch {
        return initialValue;
      }
    },
    setItem: (key, value) => {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
    removeItem: (key) => localStorage.removeItem(key),
  }
);

export const userIdAtom = atom<string | null>(null);
export const clientReadyAtom = atom(false);

export const DEFAULT_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const serverUploadLimitAtom = atom<number>(DEFAULT_MAX_UPLOAD_BYTES);
