import { atom } from 'jotai';

export interface CommandActions {
  placeCall?: (roomId: string) => Promise<void> | void;
  joinVoice?: (roomId: string) => Promise<void> | void;
  hangup?: () => void;
}

export const commandActionsAtom = atom<CommandActions | null>(null);
