import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { roomStateMaybe } from '@/util/matrix';

/**
 * When `userId` last joined `room` (ms since epoch), from the member events we have: the
 * current member event and the loaded timeline. A join -> join event is only a profile change
 * and says nothing about when they joined, so it is skipped. For the room's creator the
 * m.room.create event is the fallback. Returns null when unknown.
 */
export function getMemberSince(room: Room | null | undefined, userId: string): number | null {
  if (!room) return null;
  let best: number | null = null;

  const consider = (ev: MatrixEvent | null | undefined) => {
    if (!ev || ev.getType() !== 'm.room.member' || ev.getStateKey() !== userId) return;
    if (ev.getContent().membership !== 'join') return;
    if (ev.getPrevContent()?.membership === 'join') return;
    const ts = ev.getTs();
    if (ts > 0 && (best === null || ts > best)) best = ts;
  };

  const state = roomStateMaybe(room);
  consider(state?.getStateEvents('m.room.member', userId));
  for (const ev of room.getLiveTimeline().getEvents()) consider(ev);

  if (best === null) {
    const create = state?.getStateEvents('m.room.create', '');
    if (create && create.getSender() === userId && create.getTs() > 0) best = create.getTs();
  }
  return best;
}
