import { publicUrl } from '@/util/publicUrl';
import { getPackVoiceSoundUrl, type VoiceSoundKind } from '@/util/notificationSounds';

const SOUND_MAP: Record<string, string> = {
  mute: publicUrl('assets/sounds/mute.mp3'),
  unmute: publicUrl('assets/sounds/unmute.mp3'),
  'camera-on': publicUrl('assets/sounds/camera-on.mp3'),
  'camera-off': publicUrl('assets/sounds/camera-off.mp3'),
  alert: publicUrl('assets/sounds/alert.mp3'),
};

/** Plays an in-call sound; *packId* (the chosen sound pack) supplies its own version when it has one. */
export function playVoiceSound(type: keyof typeof SOUND_MAP, packId?: string): void {
  const src =
    (packId && type !== 'alert' ? getPackVoiceSoundUrl(packId, type as VoiceSoundKind) : null) ??
    SOUND_MAP[type];
  if (!src) return;
  try {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}
