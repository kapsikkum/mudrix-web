import type { MatrixClient, Room } from 'matrix-js-sdk';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';

/** The standard MatrixRTC slot used for room-wide calls. */
export const CALL_SLOT_DESCRIPTION = { application: 'm.call', id: 'ROOM' } as const;

/**
 * Whether someone is already in this room's call. Anyone else in it, including our own other
 * devices, means we join rather than start (and ring) a new call.
 */
export async function hasOngoingCall(mx: MatrixClient, room: Room): Promise<boolean> {
  try {
    const memberships = await MatrixRTCSession.sessionMembershipsForSlot(
      room,
      CALL_SLOT_DESCRIPTION
    );
    const myId = mx.getUserId();
    const myDevice = mx.getDeviceId();
    return memberships.some(
      (m) => !m.isExpired() && !(m.userId === myId && m.deviceId === myDevice)
    );
  } catch {
    return false;
  }
}
