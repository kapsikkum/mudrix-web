import { atomWithStorage } from 'jotai/utils';

export type MessageLayout = 'classic' | 'modern';
export type ThemeName = 'Carbon' | 'Parrot' | 'Ethereal';

export interface Keybinds {
  toggleMute: string;
  toggleVideo: string;
  disconnect: string;
}

export interface Preferences {
  typingIndicators: boolean;
  notificationSounds: boolean;
  sendReadReceipts: boolean;
}

export const themeAtom = atomWithStorage<ThemeName>('wizardchat-theme', 'Carbon');

export const messageLayoutAtom = atomWithStorage<MessageLayout>('wizardchat-layout', 'modern');

export const keybindsAtom = atomWithStorage<Keybinds>('wizardchat-keybinds', {
  toggleMute: '',
  toggleVideo: '',
  disconnect: '',
});

export const preferencesAtom = atomWithStorage<Preferences>('wizardchat-preferences', {
  typingIndicators: true,
  notificationSounds: true,
  sendReadReceipts: true,
});
