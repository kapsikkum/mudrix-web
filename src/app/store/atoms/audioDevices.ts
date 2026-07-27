import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import {
  STORAGE_KEY_AUDIO_DEVICE_STATE,
  STORAGE_KEY_AUDIO_SELECTED_MIC,
  STORAGE_KEY_AUDIO_SELECTED_MIC_LABEL,
  STORAGE_KEY_AUDIO_SELECTED_SPEAKER,
  STORAGE_KEY_AUDIO_SELECTED_SPEAKER_LABEL,
  STORAGE_KEY_AUDIO_SELECTED_CAMERA,
  STORAGE_KEY_AUDIO_SELECTED_CAMERA_LABEL,
  STORAGE_KEY_AUDIO_INPUT_VOLUME,
  STORAGE_KEY_AUDIO_OUTPUT_VOLUME,
} from '@/const/storageKeys';

export interface AudioDeviceState {
  micId: string;
  micLabel: string;
  speakerId: string;
  speakerLabel: string;
  cameraId: string;
  cameraLabel: string;
  inputVolume: number;
  outputVolume: number;
}

const DEFAULT_AUDIO_DEVICE_STATE: AudioDeviceState = {
  micId: '',
  micLabel: '',
  speakerId: '',
  speakerLabel: '',
  cameraId: '',
  cameraLabel: '',
  inputVolume: 1,
  outputVolume: 1,
};

function readFloat(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function migrateFromOldKeys(): AudioDeviceState {
  return {
    micId: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_MIC) ?? '',
    micLabel: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_MIC_LABEL) ?? '',
    speakerId: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_SPEAKER) ?? '',
    speakerLabel: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_SPEAKER_LABEL) ?? '',
    cameraId: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_CAMERA) ?? '',
    cameraLabel: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_CAMERA_LABEL) ?? '',
    inputVolume: readFloat(STORAGE_KEY_AUDIO_INPUT_VOLUME, 1),
    outputVolume: readFloat(STORAGE_KEY_AUDIO_OUTPUT_VOLUME, 1),
  };
}

const audioStorage = {
  getItem: (key: string, _initialValue: AudioDeviceState): AudioDeviceState => {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        return JSON.parse(raw) as AudioDeviceState;
      } catch {
        /* corrupt — fall through to migration */
      }
    }
    return migrateFromOldKeys();
  },
  setItem: (key: string, value: AudioDeviceState) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
  },
};

export const audioDeviceStateAtom = atomWithStorage<AudioDeviceState>(
  STORAGE_KEY_AUDIO_DEVICE_STATE,
  DEFAULT_AUDIO_DEVICE_STATE,
  audioStorage
);

export const audioDeviceIdsAtom = atom((get) => {
  const s = get(audioDeviceStateAtom);
  return { micId: s.micId, speakerId: s.speakerId, cameraId: s.cameraId };
});
