import { useRef, useCallback } from 'react';

export interface DeviceSettings {
  micId: string;
  speakerId: string;
  cameraId: string;
  inputVolume: number;
  outputVolume: number;
}

export function loadDeviceSettings(): DeviceSettings {
  return {
    micId: localStorage.getItem('selectedMicId') ?? '',
    speakerId: localStorage.getItem('selectedSpeakerId') ?? '',
    cameraId: localStorage.getItem('selectedCameraId') ?? '',
    inputVolume: Number(localStorage.getItem('inputVolume') ?? 1),
    outputVolume: Number(localStorage.getItem('outputVolume') ?? 1),
  };
}

export function saveDeviceSetting(key: keyof DeviceSettings, value: string | number) {
  const keyMap: Record<keyof DeviceSettings, string> = {
    micId: 'selectedMicId',
    speakerId: 'selectedSpeakerId',
    cameraId: 'selectedCameraId',
    inputVolume: 'inputVolume',
    outputVolume: 'outputVolume',
  };
  localStorage.setItem(keyMap[key], String(value));
}

export function useLocalStream() {
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const getStream = useCallback(async (micId?: string): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints = {
      audio: micId ? { deviceId: { exact: micId } } : true,
      video: false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;

    // Build audio context with gain
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    const volume = Number(localStorage.getItem('inputVolume') ?? 1);
    gain.gain.value = volume;
    source.connect(gain);
    contextRef.current = ctx;
    gainRef.current = gain;

    return stream;
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    gainRef.current = null;
  }, []);

  const setGain = useCallback((volume: number) => {
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, []);

  return { getStream, stop, setGain, streamRef };
}
