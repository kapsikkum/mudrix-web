import { useCallback, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ClientEvent, EventType, MatrixEventEvent, RoomStateEvent } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import {
  CALL_SLOT_DESCRIPTION,
  getElementCallThemeKind,
  createCallEmbed,
} from '@/app/plugins/call/useCallEmbed';
import { elementCallEmbedAtom, elementCallUiAtom } from '@/app/store/atoms/elementCall';
import { themeAtom } from '@/app/store/atoms/settings';
import { useElementCallContainer } from '@/app/plugins/call/CallEmbedProvider';
import type { CallEmbed } from '@/app/plugins/call';
import { leaveCallEmbed } from '@/app/plugins/call/disposeAfterLeave';
import { getMemberDisplayName, isDmRoom } from '@/util/matrix';

const RING_TIMEOUT_MS = 45_000;

export function useIncomingElementCall(client: MatrixClient | null) {
  const setEmbed = useSetAtom(elementCallEmbedAtom);
  const setUi = useSetAtom(elementCallUiAtom);
  const theme = useAtomValue(themeAtom);
  const { getContainer } = useElementCallContainer();

  const uiRef = useRef({
    roomId: null as string | null,
    incoming: null as null | { roomId: string },
  });
  const ui = useAtomValue(elementCallUiAtom);
  uiRef.current = ui;

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setUi((prev) => ({ ...prev, incoming: null }));
  }, [clearTimer, setUi]);

  const accept = useCallback(
    async (roomId: string) => {
      if (!client) return;
      const room = client.getRoom(roomId);
      const container = getContainer();
      if (!room || !container) return;

      setUi((prev) => ({ ...prev, incoming: null, popOut: false }));

      let toReplace: CallEmbed | null = null;
      setEmbed((prev) => {
        if (prev) {
          toReplace = prev;
          prev.iframe.style.display = 'none';
        }
        return null;
      });

      if (toReplace) {
        await leaveCallEmbed(toReplace);
      }

      try {
        const embed = await createCallEmbed(client, room, {
          voiceOnly: false,
          themeKind: getElementCallThemeKind(theme),
          container,
        });
        setEmbed(embed);
        setUi((prev) => ({
          ...prev,
          roomId: room.roomId,
          phase: 'joining',
          voiceOnly: false,
          isMuted: false,
          isVideoMuted: false,
          popOut: false,
        }));
      } catch (err) {
        console.error('Failed to accept incoming call:', err);
        setUi((prev) => ({ ...prev, roomId: null, phase: 'idle' }));
      }
    },
    [client, getContainer, setEmbed, setUi, theme]
  );

  useEffect(() => {
    if (!client) return undefined;

    const handleEvent = async (ev: MatrixEvent) => {
      if (ev.getType() !== EventType.GroupCallMemberPrefix) return;

      const roomId = ev.getRoomId();
      const sender = ev.getSender();
      if (!roomId || !sender) return;
      if (sender === client.getUserId()) return;

      if (uiRef.current.roomId === roomId || uiRef.current.incoming) return;

      const room = client.getRoom(roomId);
      if (!room) return;
      if (!isDmRoom(room, client)) return;

      const memberships = await MatrixRTCSession.sessionMembershipsForSlot(
        room,
        CALL_SLOT_DESCRIPTION
      );
      const ringing = memberships.find(
        (m) =>
          m.userId === sender &&
          !m.isExpired() &&
          m.createdTs() > Date.now() - RING_TIMEOUT_MS &&
          (m.callIntent === 'ring' || m.callIntent === 'video' || m.callIntent === 'audio')
      );
      if (!ringing) return;

      const callerName = getMemberDisplayName(sender, client, roomId);
      setUi((prev) => ({
        ...prev,
        incoming: {
          roomId,
          callerId: sender,
          callerName,
          voiceOnly: ringing.callIntent === 'audio',
        },
      }));

      clearTimer();
      dismissTimerRef.current = setTimeout(dismiss, RING_TIMEOUT_MS);
    };

    client.on(ClientEvent.Event, handleEvent);
    client.on(MatrixEventEvent.Decrypted, handleEvent);
    client.on(RoomStateEvent.Events, handleEvent);
    return () => {
      client.off(ClientEvent.Event, handleEvent);
      client.off(MatrixEventEvent.Decrypted, handleEvent);
      client.off(RoomStateEvent.Events, handleEvent);
    };
  }, [client, clearTimer, dismiss, setUi]);

  return { accept, dismiss };
}
