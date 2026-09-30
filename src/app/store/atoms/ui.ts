import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import type {
  VerificationRequest,
  EmojiMapping,
  ShowSasCallbacks,
} from 'matrix-js-sdk/lib/crypto-api/verification';
import {
  STORAGE_KEY_SIDEBAR_VIEW,
  STORAGE_KEY_UPDATE_DEFERRED_UNTIL,
  STORAGE_KEY_CLOSED_NAV_CATEGORIES,
  STORAGE_KEY_OPEN_LOBBY_CATEGORIES,
  STORAGE_KEY_THREAD_LAST_SEEN,
  STORAGE_KEY_THREAD_PANEL_WIDTH,
  STORAGE_KEY_HIDDEN_MEDIA,
  STORAGE_KEY_EMOJI_FREQUENCY,
  STORAGE_KEY_RECENT_EMOJI,
  STORAGE_KEY_RECENT_INVITES,
  STORAGE_KEY_MEMBERS_PANEL,
} from '@/const/storageKeys';

// Sync state from matrix-js-sdk
export type SyncState =
  | 'PREPARED'
  | 'SYNCING'
  | 'RECONNECTING'
  | 'ERROR'
  | 'CATCHUP'
  | 'STOPPED'
  | null;
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
  confirmLabel?: string;
  cancelLabel?: string;
  cancelPrimary?: boolean;
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
  voiceRoom?: boolean;
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
export const roomSettingsTabAtom = atom<
  'general' | 'security' | 'permissions' | 'widgets' | 'emojis' | null
>(null);
export const spaceSettingsRoomIdAtom = atom<string | null>(null);

export interface AddRoomToSpaceState {
  open: boolean;
  spaceId: string;
  spaceName: string;
  type?: 'room' | 'subspace';
}
export const addRoomToSpaceAtom = atom<AddRoomToSpaceState | null>(null);

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

// Cross-signing UIA modal — shown when uploading cross-signing keys requires re-auth
export interface CrossSigningUiaState {
  open: boolean;
  offerSso: boolean;
  error?: string;
  resetUrl?: string;
  resolve?: (
    result: { type: 'password'; password: string } | { type: 'sso' } | { type: 'reset' } | null
  ) => void;
}
export const crossSigningUiaAtom = atom<CrossSigningUiaState>({ open: false, offerSso: false });

export const roomSwitcherOpenAtom = atom(false);
export const keyboardShortcutsOpenAtom = atom(false);
export const exploreOpenAtom = atom(false);

export interface AttachmentPreviewItem {
  id: string;
  file: File;
  previewUrl: string;
  oversized: boolean;
}
export const attachmentPreviewAtom = atom<AttachmentPreviewItem[]>([]);

export interface AttachmentPendingSendItem {
  file: File;
  caption: string;
  spoiler: boolean;
}
export const attachmentPendingSendAtom = atom<AttachmentPendingSendItem[] | null>(null);

export interface ReportMessageState {
  open: boolean;
  roomId: string;
  eventId: string;
  senderId: string;
  resolve?: (reason: string | null) => void;
}
export const reportMessageAtom = atom<ReportMessageState>({
  open: false,
  roomId: '',
  eventId: '',
  senderId: '',
});

// Badge on the settings gear icon when recovery key needs attention
export const recoveryKeyBadgeAtom = atom<'restore' | null>(null);

// Auto prompt: tracks whether we have already shown the single login-time
// "encryption isn't set up on this device" toast this session (covers restore,
// existing-encryption, setup-failure and unverified-device states) so we never
// badger the user twice. Not persisted — resets on page reload.
export const autoPromptedAtom = atom<boolean>(false);

// Target page to open in Settings (set externally before settingsOpenAtom)
export type SettingsPage =
  | 'account'
  | 'appearance'
  | 'preferences'
  | 'notifications'
  | 'emojis-stickers'
  | 'keybinds'
  | 'developer'
  | 'sessions'
  | 'about';
export const settingsPageAtom = atom<SettingsPage | null>(null);

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
  msgtype: string;
  threadId?: string | null;
}
export const editMessageAtom = atom<EditMessageState | null>(null);

export const editComposerEmojiInserterAtom = atom<{
  (emoji: string, mxcUrl?: string): void;
} | null>(null);

export interface EmojiPickerState {
  anchor: HTMLElement | null;
  anchorRect?: { x: number; y: number; width: number; height: number } | null;
  onPick: (emoji: string, mxcUrl?: string) => void;
  client: MatrixClient;
  roomId: string;
}
export const emojiPickerAtom = atom<EmojiPickerState | null>(null);

export const membersPanelOpenAtom = atom(
  typeof window !== 'undefined' ? window.innerWidth >= 768 : true
);
export const spaceMembersPanelOpenAtom = atom(false);

export type ThreadsPanelView = { type: 'list' } | { type: 'thread'; rootEvent: MatrixEvent };

export const threadsPanelViewAtom = atom<ThreadsPanelView | null>(null);
export const threadFilterAtom = atom<'all' | 'my'>('all');
export const threadPanelExpandedAtom = atom(false);

export const THREAD_PANEL_WIDTH_MIN = 320;
export const THREAD_PANEL_WIDTH_MAX = 600;
export const THREAD_PANEL_WIDTH_DEFAULT = 320;
export const threadPanelWidthAtom = atomWithStorage<number>(
  STORAGE_KEY_THREAD_PANEL_WIDTH,
  THREAD_PANEL_WIDTH_DEFAULT
);

// Maps thread root event ID -> last-seen renderable reply event ID.
// Persisted to localStorage so the unread dot stays cleared across hot reloads and page refreshes.
export const threadLastSeenAtom = atomWithStorage<Record<string, string>>(
  STORAGE_KEY_THREAD_LAST_SEEN,
  {}
);

// Maps media event ID -> hidden by the local user (per-message "hide media").
// Persisted so a hidden message stays hidden across reloads.
export const hiddenMediaAtom = atomWithStorage<Record<string, boolean>>(
  STORAGE_KEY_HIDDEN_MEDIA,
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

export const openLobbyCategoriesAtom = atomWithStorage<string[]>(
  STORAGE_KEY_OPEN_LOBBY_CATEGORIES,
  []
);

export const emojiFrequencyAtom = atomWithStorage<Record<string, number>>(
  STORAGE_KEY_EMOJI_FREQUENCY,
  {}
);

export const recentEmojiAtom = atomWithStorage<{ emoji: string; label: string; url?: string }[]>(
  STORAGE_KEY_RECENT_EMOJI,
  []
);

interface RecentUser {
  userId: string;
  displayName: string;
  avatarMxc: string | null;
  timestamp: number;
}

export const recentInvitesAtom = atomWithStorage<RecentUser[]>(STORAGE_KEY_RECENT_INVITES, []);

export const membersPanelStateAtom = atomWithStorage<{
  sort: 'az' | 'za';
}>(STORAGE_KEY_MEMBERS_PANEL, { sort: 'az' });

export const optimisticRedactedIdsAtom = atom<ReadonlySet<string>>(new Set<string>());

export const optimisticEditBodiesAtom = atom<ReadonlyMap<string, string>>(
  new Map<string, string>()
);
