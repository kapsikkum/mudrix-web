import { useCallback, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  elementCallEmbedAtom,
  elementCallActionsAtom,
  elementCallUiAtom,
} from '@/app/store/atoms/elementCall';
import {
  useStartElementCall,
  useElementCallHangup,
  useElementCallControls,
  useElementCallJoined,
} from '@/app/plugins/call/useCallEmbed';

export function ElementCallController() {
  const embed = useAtomValue(elementCallEmbedAtom);
  const setActions = useSetAtom(elementCallActionsAtom);
  const setUi = useSetAtom(elementCallUiAtom);

  const start = useStartElementCall();
  const hangup = useElementCallHangup(embed);
  const { toggleMute, toggleDeafen, toggleVideo } = useElementCallControls(embed);
  useElementCallJoined(embed);

  const togglePopOut = useCallback(() => {
    setUi((prev) => ({ ...prev, popOut: !prev.popOut }));
  }, [setUi]);

  useEffect(() => {
    setActions({ start, hangup, toggleMute, toggleDeafen, toggleVideo, togglePopOut });
    return () => setActions(null);
  }, [start, hangup, toggleMute, toggleDeafen, toggleVideo, togglePopOut, setActions]);

  return null;
}
