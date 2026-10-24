import type { MatrixClient } from 'matrix-js-sdk';
import { roomStateMaybe } from '@/util/matrix';

const SPACE_CHILD = 'm.space.child';

/** `order` is only honoured when it is 1-50 printable ASCII characters (the Matrix spec). */
export function validChildOrder(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 50) return undefined;
  return /^[\x20-\x7e]+$/.test(value) ? value : undefined;
}

export interface OrderedChild {
  roomId: string;
  order?: string;
  ts: number;
}

/**
 * Space children sort by valid `order`, then by the child event's timestamp, then room id. A child
 * with no usable `order` comes after every child that has one.
 */
export function compareSpaceChildren(a: OrderedChild, b: OrderedChild): number {
  if (a.order !== undefined && b.order !== undefined) {
    if (a.order !== b.order) return a.order < b.order ? -1 : 1;
  } else if (a.order !== undefined) {
    return -1;
  } else if (b.order !== undefined) {
    return 1;
  }
  if (a.ts !== b.ts) return a.ts - b.ts;
  if (a.roomId === b.roomId) return 0;
  return a.roomId < b.roomId ? -1 : 1;
}

/** Whether the signed-in user may rearrange (send `m.space.child` in) this space. */
export function canOrderSpace(client: MatrixClient, spaceId: string): boolean {
  const state = roomStateMaybe(client.getRoom(spaceId));
  return state?.maySendStateEvent(SPACE_CHILD, client.getSafeUserId()) ?? false;
}

/**
 * Moves `childId` one place within `siblingIds` (the children as the user sees them) and rewrites
 * `order` on the children whose position changed. Keeps each event's other content (`via`,
 * `suggested`). Orders are zero-padded so they sort correctly as strings.
 */
export async function moveSpaceChild(
  client: MatrixClient,
  spaceId: string,
  siblingIds: string[],
  childId: string,
  delta: -1 | 1
): Promise<void> {
  const from = siblingIds.indexOf(childId);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= siblingIds.length) return;
  const next = [...siblingIds];
  next.splice(from, 1);
  next.splice(to, 0, childId);

  const state = roomStateMaybe(client.getRoom(spaceId));
  if (!state) return;
  const sends: Promise<unknown>[] = [];
  next.forEach((id, index) => {
    const content = state.getStateEvents(SPACE_CHILD, id)?.getContent() as
      | Record<string, unknown>
      | undefined;
    if (!content || !Array.isArray(content['via'])) return;
    const order = String((index + 1) * 10).padStart(6, '0');
    if (content['order'] === order) return;
    sends.push(
      client.sendStateEvent(spaceId, SPACE_CHILD as never, { ...content, order } as never, id)
    );
  });
  await Promise.all(sends);
}
