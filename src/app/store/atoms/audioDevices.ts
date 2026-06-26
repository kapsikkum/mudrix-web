import { atom } from 'jotai';
import {
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

function readFloat(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const audioDeviceStateAtom = atom<AudioDeviceState>({
  micId: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_MIC) ?? '',
  micLabel: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_MIC_LABEL) ?? '',
  speakerId: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_SPEAKER) ?? '',
  speakerLabel: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_SPEAKER_LABEL) ?? '',
  cameraId: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_CAMERA) ?? '',
  cameraLabel: localStorage.getItem(STORAGE_KEY_AUDIO_SELECTED_CAMERA_LABEL) ?? '',
  inputVolume: readFloat(STORAGE_KEY_AUDIO_INPUT_VOLUME, 1),
  outputVolume: readFloat(STORAGE_KEY_AUDIO_OUTPUT_VOLUME, 1),
});

export const audioDeviceIdsAtom = atom((get) => {
  const s = get(audioDeviceStateAtom);
  return { micId: s.micId, speakerId: s.speakerId, cameraId: s.cameraId };
});
