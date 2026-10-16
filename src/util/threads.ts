import type { Thread } from 'matrix-js-sdk';

export type ThreadLastSeen = Record<string, string>;

export function isThreadUnread(thread: Thread, lastSeen: ThreadLastSeen): boolean {
  const lastReplyId = thread.lastReply()?.getId();
  const seenId = lastSeen[thread.id];
  return seenId === undefined || (lastReplyId !== undefined && lastReplyId !== seenId);
}
