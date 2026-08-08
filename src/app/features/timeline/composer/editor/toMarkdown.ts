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

type Segment = { kind: 'code'; lang: string; lines: string[] } | { kind: 'node'; node: Descendant };

function collectSegments(nodes: Descendant[]): Segment[] {
  const segments: Segment[] = [];
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];
    if (isText(node)) {
      segments.push({ kind: 'node', node });
      i++;
      continue;
    }

    const el = node as CustomElement;

    if (isFenceLineParagraph(el)) {
      const inner: string[] = [];
      let j = i + 1;
      let closed = false;
      while (j < nodes.length) {
        const n = nodes[j];
        if (!isText(n) && isFenceLineParagraph(n as CustomElement)) {
          closed = true;
          break;
        }
        if (isText(n)) inner.push((n as Text).text);
        else inner.push(rawElementText(n as CustomElement));
        j++;
      }
      if (closed) {
        segments.push({ kind: 'code', lang: fenceLanguage(el), lines: inner });
        i = j + 1;
        continue;
      }
      segments.push({ kind: 'node', node: el });
      i++;
      continue;
    }

    if (isCodeOnlyParagraph(el)) {
      const run = [codeParagraphText(el as ParagraphElement)];
      let j = i + 1;
      while (j < nodes.length && isCodeOnlyParagraph(nodes[j] as CustomElement)) {
        run.push(codeParagraphText(nodes[j] as ParagraphElement));
        j++;
      }
      const multiline = run.length >= 2 || (run.length === 1 && run[0].includes('\n'));
      if (multiline) {
        const lines: string[] = [];
        run.forEach((t) => lines.push(...t.split('\n')));
        segments.push({ kind: 'code', lang: '', lines });
        i = j;
        continue;
      }
      segments.push({ kind: 'node', node: el });
      i++;
      continue;
    }

    segments.push({ kind: 'node', node: el });
    i++;
  }

  return segments;
}

export function toMarkdown(nodes: Descendant[]): {
  markdown: string;
  mentionMap: Map<string, string>;
} {
  const mentionMap = new Map<string, string>();
  const lines: string[] = [];

  for (const seg of collectSegments(nodes)) {
    if (seg.kind === 'code') {
      lines.push(`\`\`\`${seg.lang}`);
      seg.lines.forEach((l) => lines.push(l));
      lines.push('```');
      continue;
    }
    const node = seg.node;
    if (isText(node)) {
      lines.push(serializeLeaf(node as CustomText));
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
  const parts: string[] = [];

  const pushSerialized = (el: CustomElement) => {
    const { html, custom } = serializeBlockHtml(el, mentionMap);
    if (custom) hasCustomContent = true;
    parts.push(html);
  };

  for (const seg of collectSegments(nodes)) {
    if (seg.kind === 'code') {
      const codeClass = seg.lang ? ` class="language-${seg.lang}"` : '';
      parts.push(`<pre><code${codeClass}>${escapeHtml(seg.lines.join('\n'))}</code></pre>`);
      continue;
    }
    const node = seg.node;
    if (isText(node)) {
      parts.push(serializeLeafHtml(node as CustomText));
      continue;
    }
    pushSerialized(node as CustomElement);
  }

  return { html: parts.join('<br>'), mentionMap, hasCustomContent };
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
    if (isText(child)) return serializeLeafHtml(child as CustomText);
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

function serializeLeafHtml(leaf: CustomText): string {
  let html = escapeHtml(leaf.text);
  if (leaf.code) html = `<code>${html}</code>`;
  if (leaf.bold) html = `<strong>${html}</strong>`;
  if (leaf.italic) html = `<em>${html}</em>`;
  if (leaf.strikethrough) html = `<del>${html}</del>`;
  return html;
}

function paragraphText(el: ParagraphElement): string {
  return (el.children as Descendant[]).map((c) => (isText(c) ? (c as Text).text : '')).join('');
}

function isFenceLineParagraph(el: CustomElement): boolean {
  if (el.type !== 'paragraph') return false;
  return paragraphText(el as ParagraphElement)
    .trim()
    .startsWith('```');
}

function fenceLanguage(el: CustomElement): string {
  const line = paragraphText(el as ParagraphElement)
    .trim()
    .slice(3);
  return line && !line.includes(' ') ? line : '';
}

function isCodeOnlyParagraph(el: CustomElement): boolean {
  if (el.type !== 'paragraph') return false;
  const children = (el as ParagraphElement).children;
  if (children.length !== 1) return false;
  const c = children[0];
  return isText(c) && (c as CustomText).code === true;
}

function codeParagraphText(el: ParagraphElement): string {
  return (el.children[0] as Text)?.text ?? '';
}

function rawElementText(el: CustomElement): string {
  if (el.type === 'paragraph' || el.type === 'block-quote' || el.type === 'code-block') {
    return (el as { children: Descendant[] }).children
      .map((c) => (isText(c) ? (c as Text).text : ''))
      .join('');
  }
  return '';
}
