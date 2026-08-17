import { useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { elementCallActionsAtom, elementCallUiAtom } from '@/app/store/atoms/elementCall';
import { deafenedAtom, micMutedAtom } from '@/app/store/atoms/settings';

// Single source of truth for the mic / deafen state shown in the user panel.
export function useGlobalVoiceState() {
  const ui = useAtomValue(elementCallUiAtom);
  const actions = useAtomValue(elementCallActionsAtom);
  const [micMuted, setMicMuted] = useAtom(micMutedAtom);
  const [deafened, setDeafened] = useAtom(deafenedAtom);

  const joined = ui.phase === 'joined';
  const liveMicMuted = joined ? ui.isMuted : micMuted;
  const liveDeafened = joined ? ui.isDeafened : deafened;

  const toggleMic = () => {
    setMicMuted(!liveMicMuted);
    if (joined) actions?.toggleMute();
  };

  const toggleDeafen = () => {
    setDeafened(!liveDeafened);
    if (joined) actions?.toggleDeafen();
  };

  useEffect(() => {
    if (ui.phase !== 'joined') return;
    setMicMuted(ui.isMuted);
    setDeafened(ui.isDeafened);
  }, [ui.phase, ui.isMuted, ui.isDeafened, setMicMuted, setDeafened]);

  return { micMuted: liveMicMuted, deafened: liveDeafened, toggleMic, toggleDeafen };
}
