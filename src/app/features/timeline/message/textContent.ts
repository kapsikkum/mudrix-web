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

const EMOJI_PRESENTATION = /^\p{Emoji_Presentation}$/u;

export function isEmojiOnly(text: string): boolean {
  const stripped = text.trim();
  if (!stripped) return false;
  // Intl.Segmenter splits on grapheme clusters so multi-codepoint emoji
  // (flags, family sequences) each count as one unit.
  const SegmenterCtor = (
    Intl as unknown as {
      Segmenter?: new () => { segment(s: string): Iterable<{ segment: string }> };
    }
  ).Segmenter;
  const segments = SegmenterCtor
    ? [...new SegmenterCtor().segment(stripped)].map((s) => s.segment)
    : [...stripped];
  if (segments.length > 8) return false;
  return segments.every(
    (seg) => /^\s+$/.test(seg) || [...seg].some((ch) => EMOJI_PRESENTATION.test(ch))
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
