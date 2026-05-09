const SOUND_MAP: Record<string, string> = {
  join: '/assets/sounds/join.mp3',
  leave: '/assets/sounds/leave.mp3',
  mute: '/assets/sounds/mute.mp3',
  unmute: '/assets/sounds/unmute.mp3',
  'camera-on': '/assets/sounds/camera-on.mp3',
  'camera-off': '/assets/sounds/camera-off.mp3',
  'screenshare-on': '/assets/sounds/screenshare-on.mp3',
  'screenshare-off': '/assets/sounds/screenshare-off.mp3',
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
