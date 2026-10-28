import { useEffect, useMemo, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  MatrixEventEvent,
  RoomEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import { elementCallUiAtom } from '@/app/store/atoms/elementCall';
import { useElementCallMemberships } from '@/app/features/calls/useElementCallMemberships';
import {
  WATCH_EVENT_TYPE,
  parseWatchMessage,
  watchActionsAtom,
  watchStateAtom,
  watchingVideoIdAtom,
  type WatchMessage,
  type WatchState,
} from './watchTogether';

/** A video started this long ago in the room's history is a leftover, not something to join. */
const MAX_HISTORY_AGE_MS = 3 * 60 * 60 * 1000;
/** Time for the call's participant list to load before the history is checked for a running video. */
const LATE_JOIN_DELAY_MS = 1500;
const OFFSET_SAMPLES = 10;

/**
 * Keeps the watch together state in step with the call's room: sends the actions of this device
 * and applies those of everyone else in the call. Mount it once (it is in ElementCallLayer).
 *
 * Another person's message counts only when it comes from someone who is in the call right now,
 * in the room of the call this device is connected to. A device that joins late reads the latest
 * message from the room's history.
 */
export function useWatchSync(client: MatrixClient | null): void {
  const ui = useAtomValue(elementCallUiAtom);
  const setState = useSetAtom(watchStateAtom);
  const setActions = useSetAtom(watchActionsAtom);
  const setWatching = useSetAtom(watchingVideoIdAtom);

  const callRoomId = ui.phase === 'joined' ? ui.roomId : null;
  const roomIds = useMemo(() => (callRoomId ? [callRoomId] : []), [callRoomId]);
  const memberships = useElementCallMemberships(client, roomIds);
  const participants = useMemo(
    () => new Set((callRoomId ? (memberships.get(callRoomId) ?? []) : []).map((m) => m.userId)),
    [memberships, callRoomId]
  );
  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  const adoptRef = useRef<() => void>(() => {});

  useEffect(() => {
    setState(null);
    setWatching(null);
    if (!client || !callRoomId) {
      setActions(null);
      return undefined;
    }
    const roomId = callRoomId;
    const myId = client.getUserId() ?? '';
    let current: WatchState | null = null;
    let stoppedAt = 0;
    const apply = (next: WatchState | null) => {
      current = next;
      setState(next);
    };

    // How far this device's clock is ahead of the server's, plus the delay of getting a message.
    const samples: number[] = [];
    let offset = 0;
    const sampleOffset = (event: MatrixEvent) => {
      samples.push(Date.now() - event.getTs());
      if (samples.length > OFFSET_SAMPLES) samples.shift();
      offset = Math.min(...samples);
    };

    const send = (msg: WatchMessage) => {
      client.sendEvent(roomId, WATCH_EVENT_TYPE as never, msg as never).catch(() => {});
    };
    const publish = (next: WatchState) => {
      apply(next);
      send({
        t: 'state',
        videoId: next.videoId,
        startedBy: next.startedBy,
        playing: next.playing,
        position: next.position,
      });
    };

    const receive = (event: MatrixEvent, live: boolean) => {
      const sender = event.getSender();
      if (!sender || sender === myId || event.getRoomId() !== roomId) return;
      if (!participantsRef.current.has(sender)) return;
      const msg = parseWatchMessage(event.getContent());
      if (!msg) return;
      if (live) sampleOffset(event);
      const at = event.getTs() + offset;
      if (at <= stoppedAt) return;
      if (msg.t === 'stop') {
        stoppedAt = Math.max(stoppedAt, at);
        apply(null);
        return;
      }
      if (current && at < current.at) return;
      apply({
        videoId: msg.videoId,
        startedBy: msg.startedBy,
        playing: msg.playing,
        position: msg.position,
        at,
      });
    };

    // Joining a call in which a video is already playing: the latest message in the history says
    // where it is.
    const adoptFromHistory = () => {
      if (current) return;
      const room = client.getRoom(roomId);
      const events = room?.getLiveTimeline().getEvents() ?? [];
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const event = events[i];
        if (event.getType() !== WATCH_EVENT_TYPE) continue;
        if (Date.now() - event.getTs() > MAX_HISTORY_AGE_MS) return;
        const msg = parseWatchMessage(event.getContent());
        if (!msg) continue;
        if (msg.t === 'state') receive(event, false);
        return;
      }
    };
    adoptRef.current = adoptFromHistory;
    const lateJoin = setTimeout(adoptFromHistory, LATE_JOIN_DELAY_MS);

    const onTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
      removed: boolean,
      data: { liveEvent?: boolean }
    ) => {
      if (toStartOfTimeline || removed || !data?.liveEvent || room?.roomId !== roomId) return;
      if (event.getType() === WATCH_EVENT_TYPE) receive(event, true);
    };
    // An encrypted event is handled once it has decrypted.
    const onDecrypted = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId && event.getType() === WATCH_EVENT_TYPE)
        receive(event, true);
    };
    client.on(RoomEvent.Timeline, onTimeline as never);
    client.on(MatrixEventEvent.Decrypted, onDecrypted as never);

    setActions({
      start: (videoId) =>
        publish({ videoId, startedBy: myId, playing: true, position: 0, at: Date.now() }),
      update: (playing, position) => {
        if (current) publish({ ...current, playing, position, at: Date.now() });
      },
      stop: () => {
        stoppedAt = Date.now();
        apply(null);
        send({ t: 'stop' });
      },
    });

    return () => {
      clearTimeout(lateJoin);
      client.off(RoomEvent.Timeline, onTimeline as never);
      client.off(MatrixEventEvent.Decrypted, onDecrypted as never);
      adoptRef.current = () => {};
      // Whoever started the video takes it down with them.
      if (current?.startedBy === myId) send({ t: 'stop' });
      setActions(null);
    };
  }, [client, callRoomId, setState, setActions, setWatching]);

  // The participant list arrives after the call is joined: look again once it has.
  useEffect(() => {
    if (participants.size > 0) adoptRef.current();
  }, [participants]);
}
