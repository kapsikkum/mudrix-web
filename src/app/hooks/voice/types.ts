export const VOICE_STATE_TYPE = 'org.wizard.voice.member';
export const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds
export const PARTICIPANT_TTL_MS = 3 * 60_000; // 3 minutes — stale threshold

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
  jitsiRef: React.MutableRefObject<JitsiAPI | null>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  wakeLockRef: React.MutableRefObject<WakeLockSentinel | null>;
  pingIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  heartbeatIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  refreshTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  readyRef: React.MutableRefObject<boolean>;
  localJitsiIdRef: React.MutableRefObject<string | null>;
  jitsiIdToNameRef: React.MutableRefObject<Map<string, string>>;
  screensharingIdsRef: React.MutableRefObject<Set<string>>;
  cameraOnIdsRef: React.MutableRefObject<Set<string>>;
  mutedIdsRef: React.MutableRefObject<Set<string>>;
  voiceStateCacheRef: React.MutableRefObject<Record<string, unknown>>;
}
