import type { MatrixCredentials } from './types';
import { STORAGE_KEY_ACCOUNTS, STORAGE_KEY_ACTIVE_ACCOUNT } from '@/const/storageKeys';

export type AccountsMap = Record<string, MatrixCredentials>;

export function loadAccounts(): AccountsMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as AccountsMap;
  } catch {
    return {};
  }
}

export function saveAccounts(accounts: AccountsMap): void {
  localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
}

export function listAccounts(): MatrixCredentials[] {
  return Object.values(loadAccounts());
}

export function getAccount(userId: string): MatrixCredentials | null {
  return loadAccounts()[userId] ?? null;
}

export function getActiveAccountId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_ACTIVE_ACCOUNT);
}

export function setActiveAccountId(userId: string | null): void {
  if (userId) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ACCOUNT, userId);
  } else {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_ACCOUNT);
  }
}

export function upsertAccount(credentials: MatrixCredentials): void {
  const accounts = loadAccounts();
  accounts[credentials.userId] = credentials;
  saveAccounts(accounts);
}

export function removeAccount(userId: string): void {
  const accounts = loadAccounts();
  delete accounts[userId];
  saveAccounts(accounts);
}
