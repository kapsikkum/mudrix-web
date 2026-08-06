import type { Descendant } from 'slate';
import { toMarkdown, toHtml } from './toMarkdown';

export interface BuiltTextContent {
  body: string;
  content: Record<string, unknown>;
  formattedBody: string;
  mentionedUserIds: string[];
}

export function buildTextContent(
  value: Descendant[],
  options?: { forceFormatted?: boolean }
): BuiltTextContent {
  const { markdown } = toMarkdown(value);
  const body = markdown.trim();
  const { html: formattedBody, mentionMap, hasCustomContent } = toHtml(value);
  const mentionedUserIds = Array.from(mentionMap.values());

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

  if (mentionedUserIds.length > 0) {
    content['m.mentions'] = { user_ids: mentionedUserIds };
  }

  return { body, content, formattedBody, mentionedUserIds };
}
