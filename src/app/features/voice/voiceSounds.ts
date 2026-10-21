import { publicUrl } from '@/util/publicUrl';
const SOUND_MAP: Record<string, string> = {
  mute: publicUrl('assets/sounds/mute.mp3'),
  unmute: publicUrl('assets/sounds/unmute.mp3'),
  'camera-on': publicUrl('assets/sounds/camera-on.mp3'),
  'camera-off': publicUrl('assets/sounds/camera-off.mp3'),
  alert: publicUrl('assets/sounds/alert.mp3'),
};

export function playVoiceSound(type: keyof typeof SOUND_MAP): void {
  const src = SOUND_MAP[type];
  if (!src) return;
  try {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}
