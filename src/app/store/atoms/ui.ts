import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

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
export const createSpaceOpenAtom = atom(false);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: any;
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
export const exploreOpenAtom = atom(false);

// Auto-restore prompt: tracks whether we have already prompted this session
// so we don't badger the user multiple times. Not persisted — resets on page reload.
export const autoRestorePromptedAtom = atom<boolean>(false);

export interface EmojiVerificationState {
  open: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emojis?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sasCallbacks?: any;
  otherUserId?: string;
  phase: 'waiting' | 'comparing' | 'done' | 'cancelled';
}
export const emojiVerificationAtom = atom<EmojiVerificationState>({
  open: false,
  phase: 'waiting',
});

export type SidebarView = 'home' | 'dms' | 'space';
export const sidebarViewAtom = atomWithStorage<SidebarView>('wizardchat-sidebar-view', 'home');

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

export const updateAvailableAtom = atom(false);

export const updateDeferredUntilAtom = atomWithStorage<number>('wizardchat-update-deferred', 0);
