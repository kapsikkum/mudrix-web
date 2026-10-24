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
  return placeSpaceChild(client, spaceId, siblingIds, childId, from + delta);
}

/** Puts `childId` at position `to` among `siblingIds` and rewrites the `order` values that changed. */
export async function placeSpaceChild(
  client: MatrixClient,
  spaceId: string,
  siblingIds: string[],
  childId: string,
  to: number
): Promise<void> {
  const from = siblingIds.indexOf(childId);
  if (from === -1 || from === to || to < 0 || to >= siblingIds.length) return;
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

interface JoinRuleContent {
  join_rule?: string;
  allow?: { type?: string; room_id?: string }[];
}

function joinRuleOf(client: MatrixClient, roomId: string): JoinRuleContent {
  return (roomStateMaybe(client.getRoom(roomId))
    ?.getStateEvents('m.room.join_rules', '')
    ?.getContent() ?? {}) as JoinRuleContent;
}

/** The rooms whose members a restricted join rule lets in. */
function allowedSpaces(rule: JoinRuleContent): string[] {
  if (rule.join_rule !== 'restricted' && rule.join_rule !== 'knock_restricted') return [];
  return (rule.allow ?? []).flatMap((a) =>
    a.type === 'm.room_membership' && typeof a.room_id === 'string' ? [a.room_id] : []
  );
}

/**
 * Whether putting a room that follows `fromId` under `toId` would let in people who could not get
 * in before. Moving a room never does that by itself: a room out of a private category stays as
 * private as it was.
 */
function widensAccess(client: MatrixClient, fromId: string, toId: string): boolean {
  const from = joinRuleOf(client, fromId);
  const to = joinRuleOf(client, toId);
  if (to.join_rule === 'invite') return false;
  if (from.join_rule === 'public') return false;
  if (to.join_rule === 'public') return true;
  const before = new Set([fromId, ...allowedSpaces(from)]);
  return !allowedSpaces(to).every((id) => before.has(id));
}

/**
 * Moves a room from one category (a sub-space, or the space itself) to another, the way Matrix
 * expresses space membership: listed in the target, naming the target as its parent, and removed
 * from the source. A room that is restricted to its old category follows the move so the new
 * category's members can join it, unless that would open it to more people than before.
 *
 * The target is added to before the source is taken away from, and the room's own state is only
 * touched where the user has the power for it, so a failure part-way leaves the room listed, never
 * lost.
 */
export async function moveRoomToCategory(
  client: MatrixClient,
  roomId: string,
  fromSpaceId: string,
  toSpaceId: string
): Promise<void> {
  if (fromSpaceId === toSpaceId) return;
  const from = roomStateMaybe(client.getRoom(fromSpaceId))
    ?.getStateEvents(SPACE_CHILD, roomId)
    ?.getContent() as Record<string, unknown> | undefined;
  const via = Array.isArray(from?.['via']) ? (from['via'] as string[]) : [client.getDomain() ?? ''];
  await client.sendStateEvent(toSpaceId, SPACE_CHILD as never, { via } as never, roomId);

  const room = client.getRoom(roomId);
  const state = roomStateMaybe(room);
  const me = client.getSafeUserId();
  if (room && state) {
    // The room's own side of the link. Best effort: a failure here leaves a working room.
    if (state.maySendStateEvent('m.space.parent', me)) {
      try {
        await client.sendStateEvent(
          roomId,
          'm.space.parent' as never,
          { via, canonical: true } as never,
          toSpaceId
        );
        if (state.getStateEvents('m.space.parent', fromSpaceId)) {
          await client.sendStateEvent(roomId, 'm.space.parent' as never, {} as never, fromSpaceId);
        }
      } catch {
        // keep going: the child link is what makes the room appear
      }
    }

    const rule = joinRuleOf(client, roomId);
    if (
      allowedSpaces(rule).includes(fromSpaceId) &&
      state.maySendStateEvent('m.room.join_rules', me) &&
      !widensAccess(client, fromSpaceId, toSpaceId)
    ) {
      const allow = [
        ...(rule.allow ?? []).filter((a) => a.room_id !== fromSpaceId && a.room_id !== toSpaceId),
        { type: 'm.room_membership', room_id: toSpaceId },
      ];
      try {
        await client.sendStateEvent(
          roomId,
          'm.room.join_rules' as never,
          { ...rule, allow } as never,
          ''
        );
      } catch {
        // keep going: the room stays joinable by its old category
      }
    }
  }

  await client.sendStateEvent(fromSpaceId, SPACE_CHILD as never, {} as never, roomId);
}
