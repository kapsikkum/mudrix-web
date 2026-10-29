import { publicUrl } from '@/util/publicUrl';
import {
  BUILTIN_VOICE_SOUNDS,
  getPackVoiceSoundUrl,
  routeToOutput,
  type VoiceSoundKind,
} from '@/util/notificationSounds';

const SOUND_MAP: Record<string, string> = {
  ...BUILTIN_VOICE_SOUNDS,
  alert: publicUrl('assets/sounds/alert.mp3'),
  'watch-together-start': publicUrl('assets/sounds/watch-together-start.wav'),
};

/**
 * Plays an in-call sound; *packId* (already resolved through resolveSoundPack) supplies its own
 * version when it has one.
 */
export function playVoiceSound(type: keyof typeof SOUND_MAP, packId?: string): void {
  const src =
    (packId && type !== 'alert' ? getPackVoiceSoundUrl(packId, type as VoiceSoundKind) : null) ??
    SOUND_MAP[type];
  if (!src) return;
  try {
    const audio = new Audio(src);
    audio.volume = 0.5;
    routeToOutput(audio);
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}
