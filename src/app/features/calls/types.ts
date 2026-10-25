export interface VoiceParticipant {
  userId: string;
  name: string;
  mxcAvatar: string | null;
  muted: boolean;
  /** Only known for the signed-in user; Element Call doesn't share it for others. */
  deafened?: boolean;
  videoMuted: boolean;
  screensharing: boolean;
  speaking: boolean;
}
