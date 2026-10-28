import type { MatrixClient, Room } from 'matrix-js-sdk';
import { VOICE_CHANNEL_STATE_TYPE, roomState, roomStateMaybe } from '@/util/matrix';
import { newestStateEvent, sendMudrixState } from '@/util/namespace';

/** Whether a Mudrix user has dedicated this room as a voice channel. */
export function isVoiceChannelFlagged(room: Room | null | undefined): boolean {
  if (!room) return false;
  return (
    newestStateEvent(roomState(room), VOICE_CHANNEL_STATE_TYPE, '')?.getContent()?.['enabled'] ===
    true
  );
}

/** Whether the signed-in user may change the flag, and the room is a plain text room. */
export function canSetVoiceChannel(client: MatrixClient, roomId: string): boolean {
  const room = client.getRoom(roomId);
  if (!room || room.isSpaceRoom()) return false;
  // Rooms that are voice rooms by type already behave as voice rooms; the flag has no say there.
  if (
    room.getType() === 'org.matrix.msc3401.call' ||
    room.getType() === 'org.matrix.msc3417.call'
  ) {
    return false;
  }
  return (
    roomStateMaybe(room)?.maySendStateEvent(VOICE_CHANNEL_STATE_TYPE, client.getSafeUserId()) ??
    false
  );
}

export async function setVoiceChannel(
  client: MatrixClient,
  roomId: string,
  enabled: boolean
): Promise<void> {
  await sendMudrixState(client, roomId, VOICE_CHANNEL_STATE_TYPE, { enabled });
}
