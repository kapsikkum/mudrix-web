import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { markdownToHtml, plainTextToHtml } from '@/util/markdownToHtml';

export interface ReplyContent {
  eventId: string;
  body: string;
  formattedBody?: string;
  senderId: string;
  mxcUrl?: string;
  event?: MatrixEvent;
  isUndecryptable: boolean;
}

export function extractReplyMxcUrl(
  eventType: string,
  content: Record<string, unknown>
): string | undefined {
  if (eventType === 'm.sticker') {
    return (content?.url as string | undefined) ?? undefined;
  }
  if (eventType === 'm.room.message') {
    const formattedBody = content?.formatted_body as string | undefined;
    if (formattedBody) {
      const match = formattedBody.match(/<img[^>]+data-mx-emoticon[^>]+src="([^"]+)"/);
      if (match) return match[1];
    }
  }
  return undefined;
}

const EDITABLE_MSGTYPES = new Set(['m.text', 'm.emote', 'm.notice']);

export function isEditableEvent(event: MatrixEvent): boolean {
  if (event.getType() !== 'm.room.message') return false;
  const msgtype = event.getContent()?.msgtype as string | undefined;
  return msgtype !== undefined && EDITABLE_MSGTYPES.has(msgtype);
}

const MAX_REPLY_CHAIN = 10;

export function stripReplyFallback(body: string): string {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => {
    const trimmed = l.trim();
    return trimmed !== '' && !trimmed.startsWith('>');
  });
  if (start === -1) return '';
  return lines.slice(start).join('\n').replace(/^\s+/, '').trimEnd();
}

export function stripReplyFallbackHtml(formattedBody: string): string {
  return formattedBody
    .replace(/<mx-reply>[\s\S]*?<\/mx-reply>/g, '')
    .replace(/^\s+/, '')
    .trimEnd();
}

function resolveOriginalEvent(
  event: MatrixEvent,
  room: Room | null,
  maxDepth: number
): MatrixEvent {
  let current = event;
  let depth = 0;
  while (depth < maxDepth) {
    const relatesTo = current.getContent()?.['m.relates_to'];
    const parentId = relatesTo?.['m.in_reply_to']?.event_id;
    if (!parentId || relatesTo?.is_falling_back) break;
    const parent = room?.findEventById(parentId);
    if (!parent) break;
    current = parent;
    depth++;
  }
  return current;
}

export function buildReplyContent(
  targetEvent: MatrixEvent,
  client: MatrixClient
): ReplyContent | null {
  const room = client.getRoom(targetEvent.getRoomId() ?? '');
  const originalEvent = resolveOriginalEvent(targetEvent, room, MAX_REPLY_CHAIN);
  if (originalEvent.isDecryptionFailure()) {
    return {
      eventId: originalEvent.getId() ?? targetEvent.getId() ?? '',
      body: '',
      senderId: originalEvent.getSender() ?? '',
      isUndecryptable: true,
    };
  }
  const originalContent = originalEvent.getContent();
  return {
    eventId: originalEvent.getId() ?? targetEvent.getId() ?? '',
    body: stripReplyFallback((originalContent?.body as string | undefined) ?? ''),
    formattedBody:
      stripReplyFallbackHtml((originalContent?.formatted_body as string | undefined) ?? '') ||
      undefined,
    senderId: originalEvent.getSender() ?? '',
    mxcUrl: extractReplyMxcUrl(originalEvent.getType(), originalContent),
    event: originalEvent,
    isUndecryptable: false,
  };
}

export function getReplyContent(event: MatrixEvent, client: MatrixClient): ReplyContent | null {
  const content = event.getContent();
  const relatesTo = content?.['m.relates_to'];
  if (!relatesTo?.['m.in_reply_to']?.event_id) return null;
  if (relatesTo?.is_falling_back) return null;

  const room = client.getRoom(event.getRoomId() ?? '');
  const replyEventId = relatesTo['m.in_reply_to'].event_id;
  const replyEvent = room?.findEventById(replyEventId);
  if (!replyEvent) return null;

  return buildReplyContent(replyEvent, client);
}

/** Messages with more emoji than this are shown at normal size (same idea as Element's cap). */
export const MAX_EMOJI_ONLY_COUNT = 10;

const KEYCAP_CLUSTER = /^[#*0-9]\uFE0F?\u20E3$/u;
const EMOJI_CLUSTER_CHARS =
  /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\u200D|\uFE0F|[\u{E0020}-\u{E007F}])+$/u;
const EMOJI_PRESENTATION_OR_VS16 = /[\p{Emoji_Presentation}\uFE0F]/u;
// Fallback splitter for engines without Intl.Segmenter: one emoji sequence per match.
const EMOJI_SEQUENCE =
  /\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F)*(?:\u200D\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F)*)*[\u{E0020}-\u{E007F}]*/gu;

// Intl.Segmenter is missing from the TS lib target; describe the part we use.
interface GraphemeSegmenter {
  segment(text: string): Iterable<{ segment: string }>;
}
type SegmenterCtor = new (
  locale?: string | string[],
  options?: { granularity: 'grapheme' }
) => GraphemeSegmenter;

let graphemeSegmenter: GraphemeSegmenter | null | undefined;

function splitClusters(text: string): string[] {
  if (graphemeSegmenter === undefined) {
    const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
    graphemeSegmenter = Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : null;
  }
  if (graphemeSegmenter) return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
  // Regex fallback: emoji sequences stay whole, anything else is split per code point.
  const out: string[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_SEQUENCE)) {
    const start = m.index ?? 0;
    for (const ch of text.slice(last, start)) out.push(ch);
    out.push(m[0]);
    last = start + m[0].length;
  }
  for (const ch of text.slice(last)) out.push(ch);
  return out;
}

/** Whether one grapheme cluster is a (single) emoji: ZWJ sequence, flag, keycap, skin tone, etc. */
function isEmojiCluster(cluster: string): boolean {
  if (KEYCAP_CLUSTER.test(cluster)) return true;
  if (!EMOJI_CLUSTER_CHARS.test(cluster)) return false;
  // Excludes text-style symbols such as a bare (c), TM or arrow that have no emoji presentation.
  return EMOJI_PRESENTATION_OR_VS16.test(cluster);
}

/**
 * True when the rendered message is only emoji (up to MAX_EMOJI_ONLY_COUNT of them, counted as
 * grapheme clusters, so a ZWJ family or a flag counts once) and/or custom emoji images.
 */
export function isRenderedEmojiOnly(html: string): boolean {
  const div = document.createElement('div');
  div.innerHTML = html;
  let count = div.querySelectorAll('img').length;
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    for (const cluster of splitClusters(node.nodeValue ?? '')) {
      if (/^\s+$/.test(cluster)) continue;
      if (!isEmojiCluster(cluster)) return false;
      count += 1;
    }
  }
  return count > 0 && count <= MAX_EMOJI_ONLY_COUNT;
}

export function renderTextContent(
  content: Record<string, unknown>,
  myUserId?: string,
  prettifyLinks = false,
  allowedImgOrigins?: ReadonlySet<string>
): string {
  const format = content.format as string | undefined;
  const formattedBody = content.formatted_body as string | undefined;
  if (format === 'org.matrix.custom.html' && formattedBody) {
    if (/<[a-z]/i.test(formattedBody)) {
      const clean = stripReplyFallbackHtml(formattedBody);
      return markdownToHtml(clean, myUserId, true, prettifyLinks, true, allowedImgOrigins);
    }
  }
  const body = (content.body as string) ?? '';
  return plainTextToHtml(stripReplyFallback(body), myUserId, true, prettifyLinks);
}

export function getMediaCaption(content: Record<string, unknown>): string | undefined {
  const body = (content.body as string) ?? '';
  const filename = (content.filename as string | undefined) ?? (content.body as string | undefined);
  if (!body.trim()) return undefined;
  if (filename === undefined || filename === body) return undefined;
  return body;
}
