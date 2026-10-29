import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { audioOutputDeviceAtom } from '@/app/store/atoms/settings';
import { setSoundOutputDevice } from '@/util/notificationSounds';

/** Applies the chosen output device to app sounds (the running call follows the devices itself). */
export function useMediaDeviceSettings(): void {
  const audioOutput = useAtomValue(audioOutputDeviceAtom);

  useEffect(() => {
    setSoundOutputDevice(audioOutput);
  }, [audioOutput]);
}
