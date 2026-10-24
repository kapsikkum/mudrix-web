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
    incoming: null as IncomingElementCall | null,
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
      await startCall(room, { voiceOnly: incoming.voiceOnly, presentation: 'room' });
    },
    [client, startCall]
  );

  useEffect(() => {
    if (!client) return undefined;

    // Why a call membership did or did not ring. Opt in with
    // `localStorage.setItem('mudrix.debugRing', '1')`, then filter the console by "[ring]".
    const traceOn = () => {
      try {
        return localStorage.getItem('mudrix.debugRing') === '1';
      } catch {
        return false;
      }
    };
    const trace = (roomId: string, reason: string, detail?: unknown) => {
      if (!traceOn()) return;
      // eslint-disable-next-line no-console
      console.debug('[ring]', roomId, reason, detail ?? '');
    };

    const handleEvent = async (ev: MatrixEvent) => {
      if (ev.getType() !== EventType.GroupCallMemberPrefix) return;

      const roomId = ev.getRoomId();
      const sender = ev.getSender();
      const myId = client.getUserId();
      if (!roomId || !sender) return;

      const ringingRoom = uiRef.current.incoming?.roomId ?? null;
      if (uiRef.current.roomId === roomId) {
        trace(roomId, 'skip: this client is already in (or joining) this call');
        return;
      }
      if (ringingRoom && ringingRoom !== roomId) {
        trace(roomId, 'skip: already ringing for another room', ringingRoom);
        return;
      }
      // Our own membership only matters while this room is ringing (answered on another device).
      if (sender === myId && !ringingRoom) return;

      const room = client.getRoom(roomId);
      if (!room) return;
      if (!isDmRoom(room, client)) {
        trace(roomId, 'skip: not a DM');
        return;
      }

      const memberships = await MatrixRTCSession.sessionMembershipsForSlot(
        room,
        CALL_SLOT_DESCRIPTION
      );
      const active = memberships.filter((m) => !m.isExpired());

      // Discord-style: a call rings once, when someone starts it. Stop (or never start) ringing
      // when we are already in it on any device, or when the caller is gone.
      if (ringingRoom) {
        const callerId = uiRef.current.incoming?.callerId ?? null;
        const answeredElsewhere = active.some((m) => m.userId === myId);
        const callerLeft = !!callerId && !active.some((m) => m.userId === callerId);
        if (answeredElsewhere || callerLeft) dismiss();
        return;
      }
      const summary = active.map((m) => `${m.userId}/${m.deviceId}`);
      if (active.some((m) => m.userId === myId)) {
        trace(roomId, 'skip: we are already in this call on some device', summary);
        return;
      }
      // Someone joining a call that is already going is not a new call.
      if (active.some((m) => m.userId !== sender)) {
        trace(roomId, 'skip: others were already in the call', summary);
        return;
      }

      const ringing = active.find(
        (m) =>
          m.userId === sender &&
          m.createdTs() > Date.now() - RING_TIMEOUT_MS &&
          (m.callIntent === 'ring' || m.callIntent === 'video' || m.callIntent === 'audio')
      );
      if (!ringing) {
        const mine = active.find((m) => m.userId === sender);
        trace(roomId, 'skip: no fresh ringing membership from the caller', {
          found: !!mine,
          intent: mine?.callIntent,
          ageMs: mine ? Date.now() - mine.createdTs() : null,
        });
        return;
      }
      trace(roomId, 'ringing', sender);

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
