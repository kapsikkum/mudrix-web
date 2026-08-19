import { Text } from 'slate';
import type { Descendant } from 'slate';
import type { CustomElement } from './types';

export function collectMentionedUserIds(nodes: Descendant[], myId?: string): string[] {
  const seen = new Set<string>();

  const walk = (node: Descendant): void => {
    if (Text.isText(node)) return;
    const el = node as CustomElement;
    if (el.type === 'code-block') return;
    if (el.type === 'mention') {
      if (el.userId && el.userId !== myId) seen.add(el.userId);
      return;
    }
    el.children.forEach(walk);
  };

  nodes.forEach(walk);
  return Array.from(seen);
}
