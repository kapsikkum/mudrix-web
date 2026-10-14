import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { MatrixCredentials } from '@/client/types';
import {
  getActiveAccountId,
  getAccount,
  removeAccount,
  setActiveAccountId,
  upsertAccount,
} from '@/client/accounts';
import { setStoredUserId } from '@/const/accountStorage';
import { STORAGE_KEY_ACTIVE_ACCOUNT } from '@/const/storageKeys';

export type { MatrixCredentials };

export const credentialsAtom = atomWithStorage<MatrixCredentials | null>(
  STORAGE_KEY_ACTIVE_ACCOUNT,
  null,
  {
    getItem: (_key, initialValue) => {
      try {
        const activeId = getActiveAccountId();
        if (!activeId) return initialValue;
        return getAccount(activeId) ?? initialValue;
      } catch {
        return initialValue;
      }
    },
    setItem: (_key, value) => {
      if (value === null) {
        const activeId = getActiveAccountId();
        if (activeId) removeAccount(activeId);
        setActiveAccountId(null);
        setStoredUserId(null);
        return;
      }
      upsertAccount(value);
      setActiveAccountId(value.userId);
      setStoredUserId(value.userId);
    },
    removeItem: (_key) => {
      const activeId = getActiveAccountId();
      if (activeId) removeAccount(activeId);
      setActiveAccountId(null);
      setStoredUserId(null);
    },
  }
);

export const userIdAtom = atom<string | null>(null);

export const DEFAULT_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const serverUploadLimitAtom = atom<number>(DEFAULT_MAX_UPLOAD_BYTES);
