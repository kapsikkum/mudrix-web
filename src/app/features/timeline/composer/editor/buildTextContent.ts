import type { Descendant } from 'slate';
import { toMarkdown, toHtml } from './toMarkdown';
import { collectMentionedUserIds } from './mentions';

export interface BuiltTextContent {
  body: string;
  content: Record<string, unknown>;
  formattedBody: string;
  mentionedUserIds: string[];
}

export function buildTextContent(
  value: Descendant[],
  options?: { forceFormatted?: boolean; myId?: string }
): BuiltTextContent {
  const { markdown } = toMarkdown(value);
  const body = markdown.trim();
  const { html: formattedBody, hasCustomContent } = toHtml(value);
  const mentionedUserIds = collectMentionedUserIds(value, options?.myId);

  const content: Record<string, unknown> = {
    msgtype: 'm.text',
    body,
  };

  if (
    hasCustomContent ||
    mentionedUserIds.length > 0 ||
    formattedBody !== body ||
    options?.forceFormatted
  ) {
    content.format = 'org.matrix.custom.html';
    content.formatted_body = formattedBody;
  }

  // Always attach m.mentions (even empty) so legacy push rules are disabled
  content['m.mentions'] = mentionedUserIds.length > 0 ? { user_ids: mentionedUserIds } : {};

  return { body, content, formattedBody, mentionedUserIds };
}
