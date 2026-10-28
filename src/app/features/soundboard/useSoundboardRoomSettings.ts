import { useCallback, useState } from 'react';
import type { MatrixEvent } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { canSendState } from '@/app/hooks/useCanSendState';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { readExplicitRoomSoundboardSettings, writeRoomSoundboardSettings } from './boards';
import {
  DEFAULT_SOUNDBOARD_ROOM_SETTINGS,
  SOUNDBOARD_SETTINGS_TYPE,
  type SoundboardRoomSettings,
} from './types';

export interface UseSoundboardRoomSettingsResult {
  /** This room's (or space's) own setting; the default (on, everyone) when it never set one. */
  settings: SoundboardRoomSettings;
  /** Whether the setting has been made on this room. */
  isSet: boolean;
  /** Whether we may change it (needs the power level to send `chat.mudrix.soundboard.settings`). */
  canManage: boolean;
  /** Saves a change; rejects if the homeserver refuses. */
  update: (patch: Partial<SoundboardRoomSettings>) => Promise<void>;
}

/** The soundboard on/off switch and "who can play" level of one room or space. Live. */
export function useSoundboardRoomSettings(roomId: string): UseSoundboardRoomSettingsResult {
  const client = getMatrixClientOrNull();
  const [revision, setRevision] = useState(0);
  useMatrixEvent(client, 'RoomState.events', (event: MatrixEvent) => {
    const type = event.getType();
    if (type === SOUNDBOARD_SETTINGS_TYPE || type === 'm.room.power_levels') {
      setRevision((n) => n + 1);
    }
  });

  // `revision` only forces a re-read; the values come straight from the room state.
  void revision;
  const explicit = readExplicitRoomSoundboardSettings(client, roomId);
  const settings = explicit ?? DEFAULT_SOUNDBOARD_ROOM_SETTINGS;
  const canManage = canSendState(client?.getRoom(roomId) ?? null, SOUNDBOARD_SETTINGS_TYPE, client);

  const update = useCallback(
    async (patch: Partial<SoundboardRoomSettings>) => {
      const c = getMatrixClientOrNull();
      if (!c) return;
      const current =
        readExplicitRoomSoundboardSettings(c, roomId) ?? DEFAULT_SOUNDBOARD_ROOM_SETTINGS;
      await writeRoomSoundboardSettings(c, roomId, { ...current, ...patch });
    },
    [roomId]
  );

  return { settings, isSet: !!explicit, canManage, update };
}
