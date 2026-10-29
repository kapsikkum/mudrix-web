import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { keybindsAtom } from '@/app/store/atoms';
import { callUiAtom, pushToTalkHeldAtom, pushToTalkModeAtom } from '@/app/store/atoms/call';
import { callPopoutRootAtom } from './CallPopoutWindow';
import {
  isComboKeyUp,
  matchesComboDown,
  parseCombo,
} from '@/app/features/keyboardShortcuts/keyCombo';

const RELEASE_DELAY_MS = 120;

/**
 * Push to talk: while the bound key is held the microphone transmits, otherwise it is gated. On the
 * desktop app the key is also heard system-wide.
 */
export function usePushToTalk(setTransmitting: ((on: boolean) => unknown) | null): void {
  const mode = useAtomValue(pushToTalkModeAtom);
  const keyCode = useAtomValue(keybindsAtom).pushToTalk ?? '';
  const joined = useAtomValue(callUiAtom).phase === 'joined';
  const active = mode && !!setTransmitting && joined;
  const setHeld = useSetAtom(pushToTalkHeldAtom);
  const popoutRoot = useAtomValue(callPopoutRootAtom);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active || !setTransmitting) return undefined;
    const send = (on: boolean) => void setTransmitting(on);
    let pressed = false;

    const press = () => {
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
      if (pressed) return;
      pressed = true;
      setHeld(true);
      send(true);
    };
    const release = () => {
      if (!pressed) return;
      pressed = false;
      setHeld(false);
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      releaseTimer.current = setTimeout(() => {
        releaseTimer.current = null;
        send(false);
      }, RELEASE_DELAY_MS);
    };

    send(false);

    const desktop = window.electronAPI;
    let cleanupGlobal: (() => void) | undefined;
    let useLocalKeys = true;
    if (desktop?.setPushToTalkKey && desktop.onPushToTalk) {
      cleanupGlobal = desktop.onPushToTalk((down) => (down ? press() : release()));
      void desktop.setPushToTalkKey(keyCode).then((status) => {
        useLocalKeys = status !== 'active';
      });
    }

    const combo = parseCombo(keyCode);
    const onKeyDown = (e: KeyboardEvent) => {
      if (useLocalKeys && matchesComboDown(e, combo)) press();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (useLocalKeys && isComboKeyUp(e, combo)) release();
    };
    // The key is held in whichever window has focus: the app's, or the call's pop-out window.
    const windows = [window];
    const popout = popoutRoot?.ownerDocument.defaultView;
    if (popout) windows.push(popout);
    const onBlur = () => {
      if (!useLocalKeys) return;
      setTimeout(() => {
        if (!windows.some((win) => win.document.hasFocus())) release();
      }, 0);
    };

    windows.forEach((win) => {
      win.addEventListener('keydown', onKeyDown);
      win.addEventListener('keyup', onKeyUp);
      win.addEventListener('blur', onBlur);
    });

    return () => {
      windows.forEach((win) => {
        win.removeEventListener('keydown', onKeyDown);
        win.removeEventListener('keyup', onKeyUp);
        win.removeEventListener('blur', onBlur);
      });
      cleanupGlobal?.();
      void desktop?.setPushToTalkKey?.(null);
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
      setHeld(false);
    };
  }, [active, setTransmitting, keyCode, setHeld, popoutRoot]);
}
