export const VOICE_STATE_TYPE = 'org.wizard.voice.member';
export const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
export const PARTICIPANT_TTL_MS = 90_000; // 90 seconds stale threshold

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, opts: Record<string, unknown>) => JitsiAPI;
  }
}

export interface JitsiAPI {
  dispose(): void;
  executeCommand(cmd: string, ...args: unknown[]): void;
  on(event: string, cb: (...a: unknown[]) => void): void;
  addListener(event: string, cb: (...a: unknown[]) => void): void;
  getParticipantsInfo(): Array<{ id: string; displayName: string }>;
  getIFrame(): HTMLIFrameElement;
  _openDesktopPicker(): Promise<{ source: Record<string, unknown>; screenShareAudio: boolean }>;

  // DeviceId is intentionally optional: Jitsi always resolves cross-origin by label match.
  setAudioInputDevice(label: string, deviceId?: string): Promise<boolean>;
  setAudioOutputDevice(label: string, deviceId?: string): Promise<boolean>;
  setVideoInputDevice(label: string, deviceId?: string): Promise<boolean>;
  // Returns true if the browser supports changing the given device kind ('input' | 'output').
  isDeviceChangeAvailable(kind: 'input' | 'output'): boolean;
  getAvailableDevices(): Promise<{
    audioInput: MediaDeviceInfo[];
    audioOutput: MediaDeviceInfo[];
    videoInput: MediaDeviceInfo[];
  }>;
  getCurrentDevices(): Promise<{
    audioInput?: MediaDeviceInfo;
    audioOutput?: MediaDeviceInfo;
    videoInput?: MediaDeviceInfo;
  }>;
}

// All mutable refs that sub-hooks need to share across the call session.
export interface VoiceRefs {
  jitsiRef: React.RefObject<JitsiAPI | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  wakeLockRef: React.RefObject<WakeLockSentinel | null>;
  heartbeatIntervalRef: React.RefObject<ReturnType<typeof setInterval> | null>;
  refreshTimerRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
  readyRef: React.RefObject<boolean>;
  localJitsiIdRef: React.RefObject<string | null>;
  jitsiIdToNameRef: React.RefObject<Map<string, string>>;
  screensharingIdsRef: React.RefObject<Set<string>>;
  cameraOnIdsRef: React.RefObject<Set<string>>;
  mutedIdsRef: React.RefObject<Set<string>>;
  voiceStateCacheRef: React.RefObject<Record<string, unknown>>;
}
