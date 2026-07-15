import type { Descendant, Text } from 'slate';
import type {
  CustomElement,
  CustomText,
  ParagraphElement,
  BlockQuoteElement,
  CodeBlockElement,
  LinkElement,
  MentionElement,
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
