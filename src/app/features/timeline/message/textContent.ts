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
  if (relatesTo?.is_falling_back) return null;

  const replyEventId = relatesTo['m.in_reply_to'].event_id;
  const room = client.getRoom(event.getRoomId() ?? '');
  const replyEvent = room?.findEventById(replyEventId);
  if (!replyEvent) return null;

  return {
    body: replyEvent.getContent()?.body ?? '',
    senderId: replyEvent.getSender() ?? '',
  };
}

const EMOJI_PRESENTATION = /^\p{Emoji_Presentation}$/u;

const CUSTOM_EMOJI_SHORTCODE = /^:[a-zA-Z0-9_-]+:$/;

export function isEmojiOnly(text: string): boolean {
  const stripped = text.trim();
  if (!stripped) return false;
  const tokens = stripped.split(/\s+/);
  if (tokens.length > 8) return false;
  return tokens.every(
    (token) =>
      CUSTOM_EMOJI_SHORTCODE.test(token) || [...token].every((ch) => EMOJI_PRESENTATION.test(ch))
  );
}

export function renderTextContent(
  content: Record<string, unknown>,
  myUserId?: string,
  prettifyLinks = false
): string {
  const format = content.format as string | undefined;
  const formattedBody = content.formatted_body as string | undefined;
  if (format === 'org.matrix.custom.html' && formattedBody) {
    return markdownToHtml(formattedBody, myUserId, true, prettifyLinks, true);
  }
  const body = (content.body as string) ?? '';
  return markdownToHtml(body, myUserId, true, prettifyLinks);
}
