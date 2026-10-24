import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import {
  audioInputDeviceAtom,
  audioOutputDeviceAtom,
  videoInputDeviceAtom,
} from '@/app/store/atoms/settings';
import { setSoundOutputDevice } from '@/util/notificationSounds';
import { syncElementCallDevices } from '@/util/mediaDevices';

/** Applies the chosen audio/video devices to app sounds and to Element Call. */
export function useMediaDeviceSettings(): void {
  const audioInput = useAtomValue(audioInputDeviceAtom);
  const audioOutput = useAtomValue(audioOutputDeviceAtom);
  const videoInput = useAtomValue(videoInputDeviceAtom);

  useEffect(() => {
    setSoundOutputDevice(audioOutput);
  }, [audioOutput]);

  useEffect(() => {
    syncElementCallDevices({ audioInput, audioOutput, videoInput });
  }, [audioInput, audioOutput, videoInput]);
}
