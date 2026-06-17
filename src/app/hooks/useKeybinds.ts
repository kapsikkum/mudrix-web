import { useAtom } from 'jotai';
import { keybindsAtom } from '@/app/store/atoms';
import { useEffect, useCallback, useRef } from 'react';

export function useVoiceKeybinds(
  isInVoiceCall: boolean,
  handlers: {
    toggleMute: () => void;
    toggleVideo: () => void;
    disconnect: () => void;
  }
) {
  const [keybinds] = useAtom(keybindsAtom);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isInVoiceCall) return;
      // Skip if capturing keybind
      if ((e.target as Element)?.classList?.contains('keybind-input')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (keybinds.toggleMute && key === keybinds.toggleMute) {
        e.preventDefault();
        handlersRef.current.toggleMute();
      } else if (keybinds.toggleVideo && key === keybinds.toggleVideo) {
        e.preventDefault();
        handlersRef.current.toggleVideo();
      } else if (keybinds.disconnect && key === keybinds.disconnect) {
        e.preventDefault();
        handlersRef.current.disconnect();
      }
    },
    [isInVoiceCall, keybinds]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
