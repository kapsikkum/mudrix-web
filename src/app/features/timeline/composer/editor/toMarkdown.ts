import type { Descendant, Text } from 'slate';
import type {
  CustomElement,
  CustomText,
  ParagraphElement,
  BlockQuoteElement,
  CodeBlockElement,
  LinkElement,
  MentionElement,
  EmoticonElement,
} from './types';

export function toMarkdown(nodes: Descendant[]): {
  markdown: string;
  mentionMap: Map<string, string>;
} {
  const mentionMap = new Map<string, string>();
  const lines: string[] = [];

  for (const node of nodes) {
    if (isText(node)) {
      lines.push(serializeLeaf(node));
      continue;
    }
    lines.push(serializeBlock(node as CustomElement, mentionMap));
  }

  return { markdown: lines.join('\n'), mentionMap };
}

function serializeBlock(el: CustomElement, mentionMap: Map<string, string>): string {
  switch (el.type) {
    case 'paragraph':
      return serializeInlineChildren((el as ParagraphElement).children, mentionMap);

    case 'block-quote': {
      const inner = serializeInlineChildren((el as BlockQuoteElement).children, mentionMap);
      return inner
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    }

    case 'code-block': {
      const inner = serializeInlineChildren((el as CodeBlockElement).children, mentionMap);
      return `\`\`\`\n${inner}\n\`\`\``;
    }

    case 'link': {
      const linkEl = el as LinkElement;
      const label = serializeInlineChildren(linkEl.children, mentionMap);
      return `[${label}](${linkEl.url})`;
    }

    case 'mention': {
      const m = el as MentionElement;
      mentionMap.set(m.displayName, m.userId);
      return `@${m.displayName}`;
    }

    case 'emoticon': {
      const e = el as EmoticonElement;
      return `:${e.shortcode}:`;
    }

    default:
      return serializeInlineChildren((el as ParagraphElement).children, mentionMap);
  }
}

function serializeInlineChildren(children: Descendant[], mentionMap: Map<string, string>): string {
  return children
    .map((child) => {
      if (isText(child)) return serializeLeaf(child as CustomText);
      const el = child as CustomElement;
      if (el.type === 'mention') {
        const m = el as MentionElement;
        mentionMap.set(m.displayName, m.userId);
        return `@${m.displayName}`;
      }
      if (el.type === 'link') {
        const linkEl = el as LinkElement;
        const label = serializeInlineChildren(linkEl.children, mentionMap);
        return `[${label}](${linkEl.url})`;
      }
      if (el.type === 'emoticon') {
        const e = el as EmoticonElement;
        return `:${e.shortcode}:`;
      }
      return serializeBlock(el, mentionMap);
    })
    .join('');
}

function serializeLeaf(leaf: CustomText): string {
  let text = leaf.text;
  if (leaf.code) text = `\`${text}\``;
  if (leaf.bold) text = `**${text}**`;
  if (leaf.italic) text = `*${text}*`;
  if (leaf.strikethrough) text = `~~${text}~~`;
  return text;
}

function isText(node: Descendant): node is Text {
  return 'text' in node;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function toHtml(nodes: Descendant[]): {
  html: string;
  mentionMap: Map<string, string>;
  hasCustomContent: boolean;
} {
  const mentionMap = new Map<string, string>();
  let hasCustomContent = false;
  const lines: string[] = [];

  for (const node of nodes) {
    if (isText(node)) {
      lines.push(escapeHtml(serializeLeaf(node as CustomText)));
      continue;
    }
    const { html, custom } = serializeBlockHtml(node as CustomElement, mentionMap);
    if (custom) hasCustomContent = true;
    lines.push(html);
  }

  return { html: lines.join('<br>'), mentionMap, hasCustomContent };
}

function serializeBlockHtml(
  el: CustomElement,
  mentionMap: Map<string, string>
): { html: string; custom: boolean } {
  switch (el.type) {
    case 'paragraph': {
      const { html } = serializeInlineChildrenHtml((el as ParagraphElement).children, mentionMap);
      return { html, custom: false };
    }

    case 'block-quote': {
      const { html: inner } = serializeInlineChildrenHtml(
        (el as BlockQuoteElement).children,
        mentionMap
      );
      return { html: `<blockquote>${inner}</blockquote>`, custom: false };
    }

    case 'code-block': {
      const { html: inner } = serializeInlineChildrenHtml(
        (el as CodeBlockElement).children,
        mentionMap
      );
      return { html: `<pre><code>${inner}</code></pre>`, custom: false };
    }

    case 'link': {
      const linkEl = el as LinkElement;
      const { html: label } = serializeInlineChildrenHtml(linkEl.children, mentionMap);
      const safe = escapeHtml(linkEl.url);
      return { html: `<a href="${safe}">${label}</a>`, custom: false };
    }

    case 'mention': {
      const m = el as MentionElement;
      mentionMap.set(m.displayName, m.userId);
      const userId = escapeHtml(m.userId);
      const name = escapeHtml(`@${m.displayName}`);
      return {
        html: `<a href="https://matrix.to/#/${userId}">${name}</a>`,
        custom: false,
      };
    }

    case 'emoticon': {
      const e = el as EmoticonElement;
      const src = escapeHtml(e.mxcUrl);
      const sc = escapeHtml(e.shortcode);
      return {
        html: `<img data-mx-emoticon src="${src}" alt=":${sc}:" title="${sc}" height="32" />`,
        custom: true,
      };
    }

    default:
      return serializeInlineChildrenHtml((el as ParagraphElement).children, mentionMap);
  }
}

function serializeInlineChildrenHtml(
  children: Descendant[],
  mentionMap: Map<string, string>
): { html: string; custom: boolean } {
  let custom = false;
  const parts = children.map((child) => {
    if (isText(child)) return escapeHtml(serializeLeaf(child as CustomText));
    const el = child as CustomElement;
    if (el.type === 'mention') {
      const m = el as MentionElement;
      mentionMap.set(m.displayName, m.userId);
      const userId = escapeHtml(m.userId);
      const name = escapeHtml(`@${m.displayName}`);
      return `<a href="https://matrix.to/#/${userId}">${name}</a>`;
    }
    if (el.type === 'link') {
      const linkEl = el as LinkElement;
      const { html: label } = serializeInlineChildrenHtml(linkEl.children, mentionMap);
      const safe = escapeHtml(linkEl.url);
      return `<a href="${safe}">${label}</a>`;
    }
    if (el.type === 'emoticon') {
      const e = el as EmoticonElement;
      const src = escapeHtml(e.mxcUrl);
      const sc = escapeHtml(e.shortcode);
      custom = true;
      return `<img data-mx-emoticon src="${src}" alt=":${sc}:" title="${sc}" height="32" />`;
    }
    const { html, custom: c } = serializeBlockHtml(el, mentionMap);
    if (c) custom = true;
    return html;
  });
  return { html: parts.join(''), custom };
}
