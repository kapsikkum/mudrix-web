import { useCallback, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ClientEvent, EventType, MatrixEventEvent, RoomStateEvent } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { CALL_SLOT_DESCRIPTION, useStartElementCall } from '@/app/plugins/call/useCallEmbed';
import { elementCallUiAtom, type IncomingElementCall } from '@/app/store/atoms/elementCall';
import { getMemberDisplayName, isDmRoom } from '@/util/matrix';

const RING_TIMEOUT_MS = 45_000;

export function useIncomingElementCall(client: MatrixClient | null) {
  const setUi = useSetAtom(elementCallUiAtom);
  const startCall = useStartElementCall();

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
    async (incoming: IncomingElementCall) => {
      if (!client) return;
      const room = client.getRoom(incoming.roomId);
      if (!room) return;
      await startCall(room, { voiceOnly: incoming.voiceOnly, popOut: true });
    },
    [client, startCall]
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
