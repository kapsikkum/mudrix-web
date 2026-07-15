import type { Descendant } from 'slate';
import type {
  ParagraphElement,
  BlockQuoteElement,
  CodeBlockElement,
  LinkElement,
  MentionElement,
  FormattedText,
} from './types';
import { emptyDocument } from './types';

export function fromMarkdown(markdown: string): Descendant[] {
  if (!markdown.trim()) return emptyDocument();

  const lines = markdown.split('\n');
  const blocks: Descendant[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({
        type: 'code-block',
        children: [{ text: codeLines.join('\n') }],
      } as CodeBlockElement);
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({
        type: 'block-quote',
        children: parseInline(quoteLines.join('\n')),
      } as BlockQuoteElement);
      continue;
    }

    blocks.push({ type: 'paragraph', children: parseInline(line) } as ParagraphElement);
    i++;
  }

  return blocks.length > 0 ? blocks : emptyDocument();
}

type InlineNode = FormattedText | LinkElement | MentionElement;

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const re =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(~~(.+?)~~)|(`(.+?)`)|(\[([^\]]*)\]\(([^)]*)\))|(@[\w ]+)/g;

  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push({ text: text.slice(last, match.index) });

    if (match[1] !== undefined) {
      nodes.push({ text: match[2], bold: true });
    } else if (match[3] !== undefined) {
      nodes.push({ text: match[4], italic: true });
    } else if (match[5] !== undefined) {
      nodes.push({ text: match[6], strikethrough: true });
    } else if (match[7] !== undefined) {
      nodes.push({ text: match[8], code: true });
    } else if (match[9] !== undefined) {
      nodes.push({ type: 'link', url: match[11], children: [{ text: match[10] }] } as LinkElement);
    } else if (match[12] !== undefined) {
      nodes.push({
        type: 'mention',
        userId: '',
        displayName: match[12].slice(1),
        children: [{ text: '' }],
      } as MentionElement);
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) nodes.push({ text: text.slice(last) });
  if (nodes.length === 0) nodes.push({ text: '' });

  return nodes;
}
