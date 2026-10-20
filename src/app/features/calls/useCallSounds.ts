import { useEffect, useMemo, useRef } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { elementCallEmbedAtom, elementCallUiAtom } from '@/app/store/atoms/elementCall';
import {
  notificationSoundsAtom,
  notificationSoundPackAtom,
  notificationSoundVolumeAtom,
} from '@/app/store/atoms/settings';
import { playCallSound, startCallSoundLoop } from '@/util/notificationSounds';
import { isDmRoom } from '@/util/matrix';
import { uniqueMembers, useElementCallMemberships } from './useElementCallMemberships';

// Matches the window in which useIncomingElementCall keeps an incoming call ringing.
const RING_TIMEOUT_MS = 45_000;

/**
 * Plays the call sounds of the selected notification sound pack:
 *  - ring: looped while an incoming call is being offered
 *  - ringback: looped while we are in a DM call nobody else has joined yet (outgoing ring)
 *  - callend: once when a connected call ends
 * Packs that lack a file fall back to the default pack (see getCallSoundUrl).
 */
export function useCallSounds(client: MatrixClient | null): void {
  const ui = useAtomValue(elementCallUiAtom);
  const embed = useAtomValue(elementCallEmbedAtom);
  const soundsEnabled = useAtomValue(notificationSoundsAtom);
  const pack = useAtomValue(notificationSoundPackAtom);
  const volume = useAtomValue(notificationSoundVolumeAtom);

  const incomingKey = ui.incoming ? `${ui.incoming.roomId}:${ui.incoming.callerId}` : null;

  // Incoming call: loop `ring` until the offer is accepted, declined or times out.
  useEffect(() => {
    if (!soundsEnabled || !incomingKey) return undefined;
    const stop = startCallSoundLoop(pack, 'ring', volume);
    return () => stop?.();
  }, [soundsEnabled, incomingKey, pack, volume]);

  // Outgoing call: loop `ringback` while we are connected alone in a DM call.
  const callRoomId = ui.roomId;
  const callRoom = callRoomId && client ? client.getRoom(callRoomId) : null;
  const isDmCall = !!client && !!callRoom && isDmRoom(callRoom, client);
  const watchedRoomIds = useMemo(
    () => (isDmCall && callRoomId ? [callRoomId] : []),
    [isDmCall, callRoomId]
  );
  const memberships = useElementCallMemberships(client, watchedRoomIds);
  const myId = client?.getUserId() ?? null;
  const remoteJoined =
    !!callRoomId && uniqueMembers(memberships.get(callRoomId) ?? []).some((m) => m.userId !== myId);

  // Once the other side has been seen in this call, a later "alone again" must not ring back.
  const remoteSeenRef = useRef<{ embed: unknown; seen: boolean }>({ embed: null, seen: false });
  if (remoteSeenRef.current.embed !== embed) remoteSeenRef.current = { embed, seen: false };
  if (remoteJoined) remoteSeenRef.current.seen = true;

  // Wait for the first memberships lookup so joining an already-running DM call never blips.
  const membershipsKnown = !!callRoomId && memberships.has(callRoomId);
  const ringbackActive =
    soundsEnabled &&
    isDmCall &&
    membershipsKnown &&
    ui.phase === 'joined' &&
    !remoteSeenRef.current.seen;

  useEffect(() => {
    if (!ringbackActive) return undefined;
    const stop = startCallSoundLoop(pack, 'ringback', volume);
    const timer = window.setTimeout(() => stop?.(), RING_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timer);
      stop?.();
    };
  }, [ringbackActive, pack, volume, embed]);

  // Call end: once, when a connected call goes away.
  const prevCallRef = useRef<{ roomId: string | null; joined: boolean }>({
    roomId: null,
    joined: false,
  });
  const soundRef = useRef({ soundsEnabled, pack, volume });
  soundRef.current = { soundsEnabled, pack, volume };
  useEffect(() => {
    const prev = prevCallRef.current;
    const joined = ui.phase === 'joined';
    if (prev.roomId !== null && prev.joined && ui.roomId === null) {
      const { soundsEnabled: enabled, pack: currentPack, volume: currentVolume } = soundRef.current;
      if (enabled) playCallSound(currentPack, 'callend', currentVolume);
    }
    prevCallRef.current = { roomId: ui.roomId, joined };
  }, [ui.roomId, ui.phase]);
}
