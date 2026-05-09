import { atom } from 'jotai';

export interface VoiceParticipant {
  userId: string | null; // null = external (link-joined via Jitsi, no Matrix account)
  name: string;
  mxcAvatar: string | null;
  jitsiId: string | null;
  muted: boolean;
  videoMuted: boolean;
  screensharing: boolean;
  external: boolean;
}

export interface VoiceState {
  roomId: string | null;
  roomName: string | null; // cached room name for JitsiEmbed display
  jitsiDomain: string | null; // cached domain for copy-link
  isMuted: boolean;
  isVideoMuted: boolean;
  popOut: boolean; // true = floating PIP
  connectionQuality: number; // 0–100
  pingMs: number | null;
  participants: VoiceParticipant[];
  dominantSpeakerId: string | null; // Jitsi participant ID
  ready: boolean; // true after videoConferenceJoined
}

export const voiceStateAtom = atom<VoiceState>({
  roomId: null,
  roomName: null,
  jitsiDomain: null,
  isMuted: false,
  isVideoMuted: true,
  popOut: false,
  connectionQuality: 100,
  pingMs: null,
  participants: [],
  dominantSpeakerId: null,
  ready: false,
});

export const isInVoiceCallAtom = atom((get) => get(voiceStateAtom).roomId !== null);
