import { useCallback, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { audioDeviceStateAtom } from '@/app/store/atoms/audioDevices';
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

export interface DeviceList {
  mics: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
}

export const supportsSinkId =
  typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

export function useAudioDeviceSettings() {
  const [state, setState] = useAtom(audioDeviceStateAtom);
  const [devices, setDevices] = useState<DeviceList>({ mics: [], speakers: [], cameras: [] });

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        mics: all.filter((d) => d.kind === 'audioinput'),
        speakers: all.filter((d) => d.kind === 'audiooutput'),
        cameras: all.filter((d) => d.kind === 'videoinput'),
      });
    } catch {
      // no permissions yet, labels will be empty
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  const setMic = useCallback(
    (id: string, label: string) => {
      localStorage.setItem(STORAGE_KEY_AUDIO_SELECTED_MIC, id);
      localStorage.setItem(STORAGE_KEY_AUDIO_SELECTED_MIC_LABEL, label);
      setState((prev) => ({ ...prev, micId: id, micLabel: label }));
    },
    [setState]
  );

  const setSpeaker = useCallback(
    (id: string, label: string) => {
      localStorage.setItem(STORAGE_KEY_AUDIO_SELECTED_SPEAKER, id);
      localStorage.setItem(STORAGE_KEY_AUDIO_SELECTED_SPEAKER_LABEL, label);
      setState((prev) => ({ ...prev, speakerId: id, speakerLabel: label }));
    },
    [setState]
  );

  const setCamera = useCallback(
    (id: string, label: string) => {
      localStorage.setItem(STORAGE_KEY_AUDIO_SELECTED_CAMERA, id);
      localStorage.setItem(STORAGE_KEY_AUDIO_SELECTED_CAMERA_LABEL, label);
      setState((prev) => ({ ...prev, cameraId: id, cameraLabel: label }));
    },
    [setState]
  );

  const setInputVolume = useCallback(
    (v: number) => {
      localStorage.setItem(STORAGE_KEY_AUDIO_INPUT_VOLUME, String(v));
      setState((prev) => ({ ...prev, inputVolume: v }));
    },
    [setState]
  );

  const setOutputVolume = useCallback(
    (v: number) => {
      localStorage.setItem(STORAGE_KEY_AUDIO_OUTPUT_VOLUME, String(v));
      setState((prev) => ({ ...prev, outputVolume: v }));
    },
    [setState]
  );

  return {
    ...state,
    devices,
    supportsSinkId,
    refreshDevices,
    setMic,
    setSpeaker,
    setCamera,
    setInputVolume,
    setOutputVolume,
  };
}
