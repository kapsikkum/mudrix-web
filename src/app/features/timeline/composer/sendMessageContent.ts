import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';

export interface ReplyMetadataOptions {
  replyTo?: MatrixEvent | null;
  myId?: string;
  mentionedUserIds?: string[];
}

export function applyReplyMetadata(
  content: Record<string, unknown>,
  { replyTo, myId, mentionedUserIds = [] }: ReplyMetadataOptions
): void {
  if (!replyTo) return;

  const replyId = replyTo.getId();
  const replySenderId = replyTo.getSender();
  if (replyId) {
    content['m.relates_to'] = { 'm.in_reply_to': { event_id: replyId } };
  }
  const existingMentions = (content['m.mentions'] as
    | { user_ids?: string[]; room?: boolean }
    | undefined) ?? { user_ids: [] };
  const allMentions = new Set([...(existingMentions.user_ids ?? []), ...mentionedUserIds]);
  if (replySenderId && replySenderId !== myId) allMentions.add(replySenderId);
  const newMentions: Record<string, unknown> =
    allMentions.size > 0 ? { user_ids: Array.from(allMentions) } : {};
  if (existingMentions.room) newMentions.room = true;
  content['m.mentions'] = newMentions;
}

export interface SendMessageContentOptions extends ReplyMetadataOptions {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
}

export async function sendMessageContent(
  content: Record<string, unknown>,
  { client, roomId, threadId, replyTo, myId, mentionedUserIds = [] }: SendMessageContentOptions
): Promise<void> {
  applyReplyMetadata(content, { replyTo, myId, mentionedUserIds });

  if (threadId) {
    await client.sendEvent(
      roomId,
      threadId,
      EventType.RoomMessage,
      content as unknown as RoomMessageEventContent
    );
  } else {
    await client.sendMessage(roomId, content as unknown as RoomMessageEventContent);
  }
}
