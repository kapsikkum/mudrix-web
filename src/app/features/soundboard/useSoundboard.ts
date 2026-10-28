import { useCallback, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { ClientEvent, type MatrixClient, type MatrixEvent } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { elementCallUiAtom } from '@/app/store/atoms/elementCall';
import { soundboardEnabledAtom } from '@/app/store/atoms/settings';
import { canSendState } from '@/app/hooks/useCanSendState';
import {
  evaluateSoundboardAccess,
  readPersonalBoard,
  readRoomBoard,
  readRoomClips,
  writePersonalBoard,
  writeRoomBoard,
  type SoundboardAccess,
} from './boards';
import { useBuiltInSounds } from './manifest';
import { playSoundboard } from './play';
import {
  SOUNDBOARD_DATA_TYPE,
  SOUNDBOARD_MAX_SOUNDS,
  SOUNDBOARD_SETTINGS_TYPE,
  SoundboardError,
  type PlaySoundboardResult,
  type SoundboardClip,
  type SoundboardSound,
} from './types';
import { cleanSoundName, uploadSoundFile } from './upload';

const RELEVANT_STATE_TYPES = new Set([
  SOUNDBOARD_DATA_TYPE,
  SOUNDBOARD_SETTINGS_TYPE,
  'm.space.child',
  'm.room.power_levels',
]);

export type SoundboardTarget = 'personal' | 'room';

export interface SoundboardClipPatch {
  name?: string;
  /** '' removes the emoji. */
  emoji?: string;
  /** 0..1 */
  volume?: number;
}

export interface UseSoundboardResult {
  /** The "Enable soundboard" device preference. When false, hide the soundboard UI. */
  enabled: boolean;
  /** Bundled clips (from manifest.json; empty if there is none). Always available, never stored. */
  builtIn: SoundboardClip[];
  /** The signed-in user's own clips (account data). */
  personal: SoundboardClip[];
  /** Clips of this room and the spaces it is in; each has `originRoomId`. */
  room: SoundboardClip[];
  /** Whether this room/space allows the soundboard and lets us play ('room-disabled' | 'forbidden' otherwise). */
  access: SoundboardAccess;
  /** enabled, connected to a call in this room, and allowed here. */
  canPlay: boolean;
  /** Whether we may add/edit/remove clips on this room's board (needs the power level to send state). */
  canManageRoom: boolean;
  /** Plays a clip here and sends it to the call. See playSoundboard for the result values. */
  play: (clip: SoundboardClip) => PlaySoundboardResult;
  /**
   * Validates (mp3/ogg/wav, at most 512 KB and 5 s), uploads and saves a new clip to the personal
   * board or to this room's board. Rejects with SoundboardError (see `code`).
   */
  addSound: (
    target: SoundboardTarget,
    file: File,
    meta: { name: string; emoji?: string; volume?: number }
  ) => Promise<SoundboardSound>;
  /** Changes a personal or room clip's name, emoji or volume (a built-in clip cannot be edited). */
  editSound: (clip: SoundboardClip, patch: SoundboardClipPatch) => Promise<void>;
  /** Removes a personal or room clip from its board (the uploaded file stays on the server). */
  removeSound: (clip: SoundboardClip) => Promise<void>;
}

function requireClient(): MatrixClient {
  const client = getMatrixClientOrNull();
  if (!client) throw new SoundboardError('offline');
  return client;
}

/**
 * Everything the soundboard UI needs for the call in `roomId`: the three clip lists, whether the
 * user can play, and add/edit/remove. All lists update live as account data and room state change.
 */
export function useSoundboard(roomId: string | null | undefined): UseSoundboardResult {
  const client = getMatrixClientOrNull();
  const enabled = useAtomValue(soundboardEnabledAtom);
  const ui = useAtomValue(elementCallUiAtom);
  const builtIn = useBuiltInSounds();
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);

  useMatrixEvent(client, ClientEvent.AccountData, (event: MatrixEvent) => {
    if (event.getType() === SOUNDBOARD_DATA_TYPE) bump();
  });
  useMatrixEvent(client, 'RoomState.events', (event: MatrixEvent) => {
    if (RELEVANT_STATE_TYPES.has(event.getType())) bump();
  });

  const myId = client?.getUserId() ?? null;
  const personal = useMemo<SoundboardClip[]>(
    () => readPersonalBoard(client).map((s) => ({ ...s, source: 'personal' as const })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, revision]
  );
  const room = useMemo<SoundboardClip[]>(
    () => (roomId ? readRoomClips(client, roomId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, roomId, revision]
  );
  const access: SoundboardAccess = useMemo(
    () => (client && roomId && myId ? evaluateSoundboardAccess(client, roomId, myId) : 'ok'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, roomId, myId, revision]
  );
  const canManageRoom = useMemo(
    () => !!roomId && canSendState(client?.getRoom(roomId) ?? null, SOUNDBOARD_DATA_TYPE, client),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, roomId, revision]
  );
  const canPlay =
    enabled && access === 'ok' && !!roomId && ui.roomId === roomId && ui.phase === 'joined';

  const play = useCallback(
    (clip: SoundboardClip) =>
      roomId ? playSoundboard(roomId, clip) : ('not-in-call' as PlaySoundboardResult),
    [roomId]
  );

  const addSound = useCallback<UseSoundboardResult['addSound']>(
    async (target, file, meta) => {
      const c = requireClient();
      if (target === 'room') {
        if (!roomId || !canSendState(c.getRoom(roomId), SOUNDBOARD_DATA_TYPE, c)) {
          throw new SoundboardError('forbidden');
        }
        if (readRoomBoard(c, roomId).length >= SOUNDBOARD_MAX_SOUNDS) {
          throw new SoundboardError('limit');
        }
      } else if (readPersonalBoard(c).length >= SOUNDBOARD_MAX_SOUNDS) {
        throw new SoundboardError('limit');
      }
      const sound = await uploadSoundFile(c, file, meta);
      // Read again after the upload: the board may have changed meanwhile.
      if (target === 'room' && roomId) {
        await writeRoomBoard(c, roomId, [...readRoomBoard(c, roomId), sound]);
      } else {
        await writePersonalBoard(c, [...readPersonalBoard(c), sound]);
      }
      return sound;
    },
    [roomId]
  );

  const updateBoard = useCallback(
    async (clip: SoundboardClip, change: (sounds: SoundboardSound[]) => SoundboardSound[]) => {
      const c = requireClient();
      if (clip.source === 'personal') {
        await writePersonalBoard(c, change(readPersonalBoard(c)));
      } else if (clip.source === 'room' && clip.originRoomId) {
        await writeRoomBoard(c, clip.originRoomId, change(readRoomBoard(c, clip.originRoomId)));
      } else {
        throw new SoundboardError('forbidden');
      }
    },
    []
  );

  const editSound = useCallback<UseSoundboardResult['editSound']>(
    (clip, patch) =>
      updateBoard(clip, (sounds) =>
        sounds.map((s) => {
          if (s.id !== clip.id) return s;
          const next = { ...s };
          if (patch.name !== undefined) next.name = cleanSoundName(patch.name) || s.name;
          if (patch.emoji !== undefined) next.emoji = patch.emoji.trim().slice(0, 16) || undefined;
          if (patch.volume !== undefined) next.volume = Math.min(1, Math.max(0, patch.volume));
          return next;
        })
      ),
    [updateBoard]
  );

  const removeSound = useCallback<UseSoundboardResult['removeSound']>(
    (clip) => updateBoard(clip, (sounds) => sounds.filter((s) => s.id !== clip.id)),
    [updateBoard]
  );

  return {
    enabled,
    builtIn,
    personal,
    room,
    access,
    canPlay,
    canManageRoom,
    play,
    addSound,
    editSound,
    removeSound,
  };
}
