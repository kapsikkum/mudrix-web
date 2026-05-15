import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { markdownToHtml } from '@/util/markdownToHtml';

export interface ReplyContent {
  body: string;
  senderId: string;
}

export function getReplyContent(event: MatrixEvent, client: MatrixClient): ReplyContent | null {
  const content = event.getContent();
  const relatesTo = content?.['m.relates_to'];
  if (!relatesTo?.['m.in_reply_to']?.event_id) return null;

  const replyEventId = relatesTo['m.in_reply_to'].event_id;
  const room = client.getRoom(event.getRoomId() ?? '');
  const replyEvent = room?.findEventById(replyEventId);
  if (!replyEvent) return null;

  return {
    body: replyEvent.getContent()?.body ?? '',
    senderId: replyEvent.getSender() ?? '',
  };
}

export function renderTextContent(content: Record<string, unknown>, myUserId?: string): string {
  const format = content.format as string | undefined;
  const formattedBody = content.formatted_body as string | undefined;
  if (format === 'org.matrix.custom.html' && formattedBody) {
    return markdownToHtml(formattedBody, myUserId);
  }
  const body = (content.body as string) ?? '';
  return markdownToHtml(body, myUserId);
}
