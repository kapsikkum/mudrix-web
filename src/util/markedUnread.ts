import type { MatrixClient, Room } from 'matrix-js-sdk';

// MSC2867. The stable name is what current specs use; the others are read for compatibility
// with clients that only ever shipped the unstable prefix (Element/FluffyChat).
export const MARKED_UNREAD_STABLE = 'm.marked_unread';
export const MARKED_UNREAD_UNSTABLE = 'org.matrix.msc2867.marked_unread';
const MARKED_UNREAD_LEGACY = 'com.famedly.marked_unread';

const READ_TYPES = [MARKED_UNREAD_STABLE, MARKED_UNREAD_UNSTABLE, MARKED_UNREAD_LEGACY] as const;

export function isRoomMarkedUnread(room: Room | null | undefined): boolean {
  if (!room) return false;
  return READ_TYPES.some(
    (type) =>
      room
        .getAccountData(type as Parameters<Room['getAccountData']>[0])
        ?.getContent<{ unread?: boolean }>()?.unread === true
  );
}

/** Sets (or clears) the "marked as unread" flag, keeping every prefix we know about consistent. */
export async function setRoomMarkedUnread(
  client: MatrixClient,
  roomId: string,
  unread: boolean
): Promise<void> {
  const room = client.getRoom(roomId);
  const content = { unread };
  const write = (type: string) =>
    client.setRoomAccountData(
      roomId,
      type as Parameters<typeof client.setRoomAccountData>[1],
      content
    );
  // Always write the stable name. Other prefixes are written when setting, or when they exist at
  // all (so a flag set by another client under an unstable name is overwritten, not left behind).
  const writes: Promise<unknown>[] = [write(MARKED_UNREAD_STABLE)];
  const exists = (type: string) =>
    !!room?.getAccountData(type as Parameters<Room['getAccountData']>[0]);
  if (unread || exists(MARKED_UNREAD_UNSTABLE)) writes.push(write(MARKED_UNREAD_UNSTABLE));
  if (exists(MARKED_UNREAD_LEGACY)) writes.push(write(MARKED_UNREAD_LEGACY));
  // Settle every write so one failing prefix cannot abort (or hide) the others.
  const results = await Promise.allSettled(writes);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) throw failed.reason;
}

const clearing = new Set<string>();

/**
 * Clears the flag (every prefix) if, and only if, it is currently set. Fire-and-forget; repeated
 * calls while a clear is in flight (the account-data echo has not arrived yet) are ignored.
 */
export function clearRoomMarkedUnread(client: MatrixClient, roomId: string): void {
  if (clearing.has(roomId)) return;
  if (!isRoomMarkedUnread(client.getRoom(roomId))) return;
  clearing.add(roomId);
  setRoomMarkedUnread(client, roomId, false)
    .catch((err) => console.warn('[markedUnread] failed to clear flag', roomId, err))
    .finally(() => {
      clearing.delete(roomId);
    });
}
