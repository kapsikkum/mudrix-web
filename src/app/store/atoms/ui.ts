import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { MatrixEvent } from 'matrix-js-sdk';
import type {
  VerificationRequest,
  EmojiMapping,
  ShowSasCallbacks,
} from 'matrix-js-sdk/lib/crypto-api/verification';
import {
  STORAGE_KEY_SIDEBAR_VIEW,
  STORAGE_KEY_UPDATE_DEFERRED_UNTIL,
  STORAGE_KEY_CLOSED_NAV_CATEGORIES,
  STORAGE_KEY_CLOSED_LOBBY_CATEGORIES,
  STORAGE_KEY_THREAD_LAST_SEEN,
} from '@/const/storageKeys';

// Sync state from matrix-js-sdk
export type SyncState = 'PREPARED' | 'SYNCING' | 'ERROR' | 'CATCHUP' | 'STOPPED' | null;
export const syncStateAtom = atom<SyncState>(null);

// Mobile
export const mobileDrawerOpenAtom = atom(false);

// Connection banner
export const connectionBannerAtom = atom<{
  visible: boolean;
  reconnected: boolean;
}>({ visible: false, reconnected: false });

// Toast notifications
export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
  onClick?: () => void;
  actionLabel?: string;
}
export const toastsAtom = atom<Toast[]>([]);

// Confirm modal
export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  danger?: boolean;
  resolve?: (confirmed: boolean) => void;
}
export const confirmModalAtom = atom<ConfirmState>({
  open: false,
  title: '',
  message: '',
});

// Prompt modal
export interface PromptState {
  open: boolean;
  title: string;
  message: string;
  defaultValue?: string;
  resolve?: (value: string | null) => void;
}
export const promptModalAtom = atom<PromptState>({
  open: false,
  title: '',
  message: '',
});

// Active modals
export const settingsOpenAtom = atom(false);

export interface CreateRoomState {
  open: boolean;
  spaceId?: string | null;
  spaceName?: string | null;
}
export const createRoomOpenAtom = atom<CreateRoomState>({ open: false });
export const newDmOpenAtom = atom(false);
export interface CreateSpaceState {
  open: boolean;
  parentSpaceId?: string | null;
  parentSpaceName?: string | null;
}
export const createSpaceOpenAtom = atom<CreateSpaceState>({ open: false });
export interface InviteModalState {
  roomId: string;
  name: string;
  isSpace: boolean;
}
export const inviteModalRoomIdAtom = atom<InviteModalState | null>(null);
export const roomSettingsRoomIdAtom = atom<string | null>(null);
export const spaceSettingsRoomIdAtom = atom<string | null>(null);

export interface VerificationBannerState {
  visible: boolean;
  text: string;
  request?: VerificationRequest;
}
export const verificationBannerAtom = atom<VerificationBannerState>({
  visible: false,
  text: '',
});

// Recovery key display modal (shown after generating a new key)
export interface RecoveryKeyModalState {
  open: boolean;
  recoveryKey: string;
  isRegenerating?: boolean;
}
export const recoveryKeyModalAtom = atom<RecoveryKeyModalState>({
  open: false,
  recoveryKey: '',
});

// Enter recovery key modal (for restoring from backup)
export interface EnterRecoveryKeyModalState {
  open: boolean;
  canSkip?: boolean;
  resolve?: (key: string | null) => void;
}
export const enterRecoveryKeyModalAtom = atom<EnterRecoveryKeyModalState>({
  open: false,
});

export const globalSearchOpenAtom = atom(false);
export const roomSwitcherOpenAtom = atom(false);
export const keyboardShortcutsOpenAtom = atom(false);
export const exploreOpenAtom = atom(false);

export interface AttachmentPreviewData {
  file: File;
  previewUrl: string;
  oversized: boolean;
}
export const attachmentPreviewAtom = atom<AttachmentPreviewData | null>(null);

export const attachmentPendingSendAtom = atom<string | null>(null);

// Badge on the settings gear icon when recovery key needs attention
export const recoveryKeyBadgeAtom = atom<'setup' | 'restore' | null>(null);

// Inline banner in the room list asking to enter recovery key (shown on subsequent reloads)
export const restoreBannerVisibleAtom = atom<boolean>(false);

// Auto-restore prompt: tracks whether we have already prompted this session
// so we don't badger the user multiple times. Not persisted — resets on page reload.
export const autoRestorePromptedAtom = atom<boolean>(false);

// Target page to open in Settings (set externally before settingsOpenAtom)
export type SettingsPage =
  | 'account'
  | 'audio'
  | 'appearance'
  | 'preferences'
  | 'keybinds'
  | 'developer'
  | 'keybackup'
  | 'sessions'
  | 'about';
export const settingsPageAtom = atom<SettingsPage | null>(null);

// Auto-setup prompt: tracks whether we have prompted the user to set up a
// recovery key this session (when no backup exists on the server).
export const autoSetupPromptedAtom = atom<boolean>(false);
export const setupRecoveryKeyModalOpenAtom = atom<boolean>(false);

// When set to true, KeyBackup will auto-trigger handleSetup on mount.
// Consumed (reset to false) after the trigger fires.
export const autoSetupTriggerAtom = atom<boolean>(false);

// When set to true, KeyBackup will auto-trigger handleRestore on mount.
// Consumed (reset to false) after the trigger fires.
export const autoRestoreTriggerAtom = atom<boolean>(false);

export interface EmojiVerificationState {
  open: boolean;
  request?: VerificationRequest;
  emojis?: EmojiMapping[];
  sasCallbacks?: ShowSasCallbacks;
  otherUserId?: string;
  phase: 'waiting' | 'comparing' | 'done' | 'cancelled';
}
export const emojiVerificationAtom = atom<EmojiVerificationState>({
  open: false,
  phase: 'waiting',
});

export type SidebarView = 'home' | 'dms' | 'space';
export const sidebarViewAtom = atomWithStorage<SidebarView>(STORAGE_KEY_SIDEBAR_VIEW, 'home');

export interface EditMessageState {
  roomId: string;
  eventId: string;
  body: string;
}
export const editMessageAtom = atom<EditMessageState | null>(null);

export interface EmojiPickerState {
  x: number;
  y: number;
  onPick: (emoji: string) => void;
}
export const emojiPickerAtom = atom<EmojiPickerState | null>(null);

export const membersPanelOpenAtom = atom(
  typeof window !== 'undefined' ? window.innerWidth >= 768 : true
);

export const activeThreadAtom = atom<MatrixEvent | null>(null);

// Maps thread root event ID → last-seen renderable reply event ID.
// Persisted to localStorage so the unread dot stays cleared across hot reloads and page refreshes.
export const threadLastSeenAtom = atomWithStorage<Record<string, string>>(
  STORAGE_KEY_THREAD_LAST_SEEN,
  {}
);

export const updateAvailableAtom = atom(false);

export const updateDeferredUntilAtom = atomWithStorage<number>(
  STORAGE_KEY_UPDATE_DEFERRED_UNTIL,
  0
);

export interface RoomScrollState {
  atBottom: boolean;
  scrollTop?: number;
}
export const timelineScrollAtom = atom(new Map<string, RoomScrollState>());

export const closedNavCategoriesAtom = atomWithStorage<string[]>(
  STORAGE_KEY_CLOSED_NAV_CATEGORIES,
  []
);

export const closedLobbyCategoriesAtom = atomWithStorage<string[]>(
  STORAGE_KEY_CLOSED_LOBBY_CATEGORIES,
  []
);

export const optimisticRedactedIdsAtom = atom<ReadonlySet<string>>(new Set<string>());

export const optimisticEditBodiesAtom = atom<ReadonlyMap<string, string>>(
  new Map<string, string>()
);
