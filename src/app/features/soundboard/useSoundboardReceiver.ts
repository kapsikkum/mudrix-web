import { useEffect, useMemo, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  MatrixEventEvent,
  RoomEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import { logger } from './log';
import { callUiAtom } from '@/app/store/atoms/call';
import {
  soundboardEnabledAtom,
  soundboardMutedUsersAtom,
  soundboardVolumeAtom,
} from '@/app/store/atoms/settings';
import { useCallMemberships } from '@/app/features/calls/useCallMemberships';
import { evaluateSoundboardAccess } from './boards';
import { RECEIVE_LIMITS, SoundboardLimiter } from './limits';
import { getBuiltInSound, loadBuiltInSounds, normalizeMimetype } from './manifest';
import { playClipLocal, stopAllSoundboard } from './playback';
import { soundboardRuntime } from './runtime';
import {
  SOUNDBOARD_MAX_DURATION_MS,
  SOUNDBOARD_PLAY_EVENT_TYPE,
  type SoundboardMimetype,
} from './types';

/** Events older than this (a backfill, a slow sync, a replay) are not played. */
const MAX_EVENT_AGE_MS = 10_000;
const SEEN_LIMIT = 200;

/**
 * Plays other people's soundboard clips while we are in a call. Mount it once, next to the other
 * call hooks (it is in ElementCallLayer). Everything is best effort: any failure is logged and the
 * call carries on.
 *
 * A clip plays only when all of this holds: we are connected to a call in the event's room; the
 * soundboard is on here, we are not deafened and the sender is not muted for soundboard; the sender
 * is in the call, is not us, and may play (room/space enabled, sender's power level high enough);
 * the event is under 10 seconds old; the clip has an allowed type and length; and the sender is
 * within the rate limit.
 */
export function useSoundboardReceiver(client: MatrixClient | null): void {
  const ui = useAtomValue(callUiAtom);
  const enabled = useAtomValue(soundboardEnabledAtom);
  const volume = useAtomValue(soundboardVolumeAtom);
  const setMutedUsers = useSetAtom(soundboardMutedUsersAtom);
  const mutedUsers = useAtomValue(soundboardMutedUsersAtom);

  const callRoomId = ui.phase === 'joined' ? ui.roomId : null;
  const roomIds = useMemo(() => (callRoomId ? [callRoomId] : []), [callRoomId]);
  const memberships = useCallMemberships(client, roomIds);
  const participants = useMemo(
    () => new Set((callRoomId ? (memberships.get(callRoomId) ?? []) : []).map((m) => m.userId)),
    [memberships, callRoomId]
  );

  // Keep the plain functions (playSoundboard, isSoundboardMuted, ...) in step with the session.
  soundboardRuntime.mounted = true;
  soundboardRuntime.enabled = enabled;
  soundboardRuntime.volume = volume;
  soundboardRuntime.mutedUsers = new Set(mutedUsers);
  soundboardRuntime.deafened = ui.isDeafened;
  soundboardRuntime.callRoomId = callRoomId;
  soundboardRuntime.setMutedUsers = setMutedUsers;
  useEffect(
    () => () => {
      soundboardRuntime.mounted = false;
      soundboardRuntime.callRoomId = null;
      soundboardRuntime.setMutedUsers = null;
      stopAllSoundboard();
    },
    []
  );

  const participantsRef = useRef(participants);
  participantsRef.current = participants;

  // Stop what is playing when it should no longer be heard.
  useEffect(() => {
    if (!callRoomId || !enabled || ui.isDeafened) stopAllSoundboard();
  }, [callRoomId, enabled, ui.isDeafened]);

  useEffect(() => {
    if (!client || !callRoomId || !enabled) return undefined;
    const myId = client.getUserId();
    const limiter = new SoundboardLimiter(RECEIVE_LIMITS);
    const seen = new Set<string>();
    // Built-in clips resolve from the manifest; have it ready before the first press.
    loadBuiltInSounds().catch(() => {});

    const handle = async (event: MatrixEvent): Promise<void> => {
      if (event.getType() !== SOUNDBOARD_PLAY_EVENT_TYPE) return;
      if (event.getRoomId() !== callRoomId) return;
      const eventId = event.getId();
      if (!eventId || seen.has(eventId)) return;
      seen.add(eventId);
      if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value as string);

      const sender = event.getSender();
      if (!sender || sender === myId) return;
      if (Date.now() - event.getTs() > MAX_EVENT_AGE_MS) return;
      if (!participantsRef.current.has(sender)) return;
      if (!soundboardRuntime.enabled || soundboardRuntime.deafened) return;
      if (soundboardRuntime.mutedUsers.has(sender)) return;
      if (evaluateSoundboardAccess(client, callRoomId, sender) !== 'ok') return;

      const sound = (event.getContent() as { sound?: Record<string, unknown> }).sound;
      if (!sound || typeof sound !== 'object' || typeof sound.id !== 'string') return;
      const volumeRaw =
        typeof sound.volume === 'number' && Number.isFinite(sound.volume) ? sound.volume : 1;
      const clipVolume = Math.min(1, Math.max(0, volumeRaw));
      const name = typeof sound.name === 'string' ? sound.name.slice(0, 64) : '';
      const emoji = typeof sound.emoji === 'string' ? sound.emoji.slice(0, 16) : undefined;

      let url: string;
      let mimetype: SoundboardMimetype;
      let durationMs: number | undefined;
      if (sound.builtin === true) {
        await loadBuiltInSounds();
        const builtIn = getBuiltInSound(sound.id);
        if (!builtIn) return;
        ({ url, mimetype, durationMs } = builtIn);
      } else {
        if (typeof sound.url !== 'string' || !sound.url.startsWith('mxc://')) return;
        const normalized = normalizeMimetype(
          typeof sound.mimetype === 'string' ? sound.mimetype : ''
        );
        if (!normalized) return;
        mimetype = normalized;
        url = sound.url;
        durationMs =
          typeof sound.durationMs === 'number' && Number.isFinite(sound.durationMs)
            ? Math.min(Math.max(sound.durationMs, 0), SOUNDBOARD_MAX_DURATION_MS)
            : undefined;
      }

      if (limiter.check(sender, sound.id) !== 'ok') return;

      await playClipLocal({
        client,
        senderId: sender,
        soundId: sound.id,
        name: name || (typeof sound.id === 'string' ? sound.id : ''),
        emoji,
        url,
        mimetype,
        volume: clipVolume,
        durationMs,
      });
    };

    const onEvent = (event: MatrixEvent): void => {
      handle(event).catch((err) => logger.warn('[soundboard] could not handle a clip', err));
    };
    const onTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
      removed: boolean,
      data: { liveEvent?: boolean }
    ): void => {
      if (toStartOfTimeline || removed || !data?.liveEvent) return;
      if (room?.roomId !== callRoomId) return;
      // An encrypted event is handled once it decrypts (see onDecrypted).
      if (event.getType() === SOUNDBOARD_PLAY_EVENT_TYPE) onEvent(event);
    };
    const onDecrypted = (event: MatrixEvent): void => {
      if (event.getRoomId() === callRoomId && event.getType() === SOUNDBOARD_PLAY_EVENT_TYPE) {
        onEvent(event);
      }
    };

    client.on(RoomEvent.Timeline, onTimeline as never);
    client.on(MatrixEventEvent.Decrypted, onDecrypted as never);
    return () => {
      client.off(RoomEvent.Timeline, onTimeline as never);
      client.off(MatrixEventEvent.Decrypted, onDecrypted as never);
    };
  }, [client, callRoomId, enabled]);
}
