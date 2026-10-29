import {
  AudioPresets,
  type RoomOptions,
  ScreenSharePresets,
  VideoPresets,
  type BaseKeyProvider,
} from 'livekit-client';
import type { AudioProcessing, PreferredDevices } from './types';

export function roomOptions(
  devices: PreferredDevices,
  audio: AudioProcessing,
  e2ee?: { keyProvider: BaseKeyProvider; worker: Worker }
): RoomOptions {
  return {
    adaptiveStream: true,
    dynacast: true,
    stopLocalTrackOnUnpublish: true,
    publishDefaults: {
      dtx: true,
      red: false,
      audioPreset: AudioPresets.music,
      videoCodec: 'vp8',
      backupCodec: { codec: 'vp8' },
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
      screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
      stopMicTrackOnMute: false,
    },
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
      deviceId: devices.videoinput,
    },
    audioOutput: devices.audiooutput ? { deviceId: devices.audiooutput } : undefined,
    audioCaptureDefaults: {
      deviceId: devices.audioinput,
      autoGainControl: audio.autoGainControl,
      echoCancellation: audio.echoCancellation,
      noiseSuppression: audio.noiseSuppression,
    },
    ...(e2ee ? { encryption: { keyProvider: e2ee.keyProvider, worker: e2ee.worker } } : {}),
  };
}
