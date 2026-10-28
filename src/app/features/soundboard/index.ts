/**
 * Soundboard core. The UI builds on:
 *  - useSoundboard(roomId): clip lists (builtIn / personal / room), canPlay, play, add/edit/remove
 *  - playSoundboard(roomId, clip): plain-function press (also what `play` calls)
 *  - soundboardPlayingAtom: who is playing which clip right now
 *  - isSoundboardMuted / toggleSoundboardMute / useSoundboardMute: per-person mute
 *  - useSoundboardRoomSettings(roomId) and <SoundboardRoomSettings roomId>: room/space admin controls
 *  - useSoundboardReceiver(client): mounted once (ElementCallLayer); plays other people's clips
 */
export * from './types';
export { useSoundboard } from './useSoundboard';
export type { SoundboardClipPatch, SoundboardTarget, UseSoundboardResult } from './useSoundboard';
export { playSoundboard, clipToPlayContent } from './play';
export { useSoundboardReceiver } from './useSoundboardReceiver';
export { useSoundboardRoomSettings } from './useSoundboardRoomSettings';
export type { UseSoundboardRoomSettingsResult } from './useSoundboardRoomSettings';
export { SoundboardRoomSettings } from './SoundboardRoomSettings';
export {
  isSoundboardMuted,
  toggleSoundboardMute,
  useSoundboardMute,
  useSoundboardMutedUsers,
} from './mute';
export {
  soundboardPlayingAtom,
  getSoundboardPlaying,
  subscribeSoundboardPlaying,
  type SoundboardPlayingEntry,
} from './playing';
export { stopAllSoundboard, prefetchClip } from './playback';
export { loadBuiltInSounds, useBuiltInSounds } from './manifest';
export { SOUNDBOARD_FILE_ACCEPT, validateSoundFile } from './upload';
export { evaluateSoundboardAccess, type SoundboardAccess } from './boards';
export { SoundboardButton } from './SoundboardButton';
export { SoundboardPanel } from './SoundboardPanel';
export {
  SoundboardMuteButton,
  SoundboardMutedBadge,
  SoundboardMutedIcon,
  SoundboardPlayingChip,
  useSoundboardPlayingFor,
} from './SoundboardPersonUi';
