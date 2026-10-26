import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  elementCallEmbedAtom,
  elementCallActionsAtom,
  elementCallUiAtom,
} from '@/app/store/atoms/elementCall';
import type { ElementCallPresentation } from '@/app/store/atoms/elementCall';
import { currentRoomIdAtom } from '@/app/store/atoms/rooms';
import {
  useStartElementCall,
  useElementCallHangup,
  useElementCallControls,
  useElementCallJoined,
} from '@/app/plugins/call/useCallEmbed';
import { usePushToTalk } from '@/app/plugins/call/usePushToTalk';
import { leaveCallEmbed } from '@/app/plugins/call/disposeAfterLeave';
import { onSessionEnd } from '@/client/initMatrix';
import { hideScreenShareBar, onScreenShareStop, showScreenShareBar } from '@/util/desktop';

/** Mirrors the call's screen-share state onto the desktop shell's floating share bar. */
function useDesktopScreenShareBar(
  sharing: boolean,
  embedAlive: boolean,
  toggleScreenshare: () => void
) {
  const { t } = useTranslation();
  const shownRef = useRef(false);
  const sharingRef = useRef(sharing);
  sharingRef.current = sharing;
  const toggleRef = useRef(toggleScreenshare);
  toggleRef.current = toggleScreenshare;
  const active = sharing && embedAlive;

  useEffect(() => {
    if (active === shownRef.current) return;
    shownRef.current = active;
    if (active) {
      showScreenShareBar({
        title: t('voice.sharingTitle'),
        stop: t('voice.stopShare'),
        back: t('voice.returnToCall'),
      });
    } else {
      hideScreenShareBar();
    }
  }, [active, t]);

  useEffect(
    () => () => {
      if (!shownRef.current) return;
      shownRef.current = false;
      hideScreenShareBar();
    },
    []
  );

  useEffect(
    () =>
      onScreenShareStop(() => {
        if (sharingRef.current) toggleRef.current();
      }),
    []
  );
}

export function ElementCallController() {
  const embed = useAtomValue(elementCallEmbedAtom);
  const setActions = useSetAtom(elementCallActionsAtom);
  const setUi = useSetAtom(elementCallUiAtom);
  const currentRoomId = useAtomValue(currentRoomIdAtom);

  const start = useStartElementCall();
  const hangup = useElementCallHangup(embed);
  const {
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenshare,
    setSpotlight,
    openReactions,
    openSettings,
  } = useElementCallControls(embed);
  useElementCallJoined(embed);
  const isScreenSharing = useAtomValue(elementCallUiAtom).isScreenSharing;
  useDesktopScreenShareBar(isScreenSharing, embed !== null, toggleScreenshare);
  usePushToTalk(embed);

  const setPresentation = useCallback(
    (presentation: ElementCallPresentation) => {
      setUi((prev) => ({ ...prev, presentation }));
    },
    [setUi]
  );

  // Switching account or signing out ends the call first, so it doesn't carry into the next session.
  const embedRef = useRef(embed);
  embedRef.current = embed;
  useEffect(
    () =>
      onSessionEnd(async () => {
        const current = embedRef.current;
        if (current) await leaveCallEmbed(current);
      }),
    []
  );

  const roomId = useAtomValue(elementCallUiAtom).roomId;
  useEffect(() => {
    if (roomId === null || currentRoomId === roomId) return;
    setUi((prev) =>
      prev.presentation === 'fullscreen' ? { ...prev, presentation: 'room' } : prev
    );
  }, [roomId, currentRoomId, setUi]);

  useEffect(() => {
    setActions({
      start,
      hangup,
      toggleMute,
      toggleDeafen,
      toggleVideo,
      toggleScreenshare,
      setSpotlight,
      openReactions,
      openSettings,
      setPresentation,
    });
    return () => setActions(null);
  }, [
    start,
    hangup,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenshare,
    setSpotlight,
    openReactions,
    openSettings,
    setPresentation,
    setActions,
  ]);

  return null;
}
