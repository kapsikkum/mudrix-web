import { useAtom } from 'jotai';
import { keybindsAtom } from '@/app/store/atoms';
import { useEffect, useCallback } from 'react';

export function useKeybinds() {
  return useAtom(keybindsAtom);
}

export function useVoiceKeybinds(
  isInVoiceCall: boolean,
  handlers: {
    toggleMute: () => void;
    toggleVideo: () => void;
    disconnect: () => void;
  }
) {
  const [keybinds] = useAtom(keybindsAtom);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isInVoiceCall) return;
      // Skip if capturing keybind
      if ((e.target as Element)?.classList?.contains('keybind-input')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (keybinds.toggleMute && key === keybinds.toggleMute) {
        e.preventDefault();
        handlers.toggleMute();
      } else if (keybinds.toggleVideo && key === keybinds.toggleVideo) {
        e.preventDefault();
        handlers.toggleVideo();
      } else if (keybinds.disconnect && key === keybinds.disconnect) {
        e.preventDefault();
        handlers.disconnect();
      }
    },
    [isInVoiceCall, keybinds, handlers]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
