import type { RenderElementProps, RenderLeafProps } from 'slate-react';
import type { CustomElement, CustomText } from './types';

export function Element({ attributes, children, element }: RenderElementProps) {
  const el = element as CustomElement;

  switch (el.type) {
    case 'block-quote':
      return <blockquote {...attributes}>{children}</blockquote>;

    case 'code-block':
      return (
        <pre {...attributes}>
          <code>{children}</code>
        </pre>
      );

    case 'link':
      return (
        <a
          {...attributes}
          href={el.url}
          target="_blank"
          rel="noopener noreferrer"
          // Prevent Slate from treating a click on the link text as cursor movement
          onClick={(e) => e.preventDefault()}
        >
          {children}
        </a>
      );

    case 'mention':
      // Void inline — children must still be rendered for Slate's DOM reconciliation
      return (
        <span
          {...attributes}
          contentEditable={false}
          className="mention-pill"
          data-user-id={el.userId}
        >
          @{el.displayName}
          {children}
        </span>
      );

    default:
      // paragraph
      return <p {...attributes}>{children}</p>;
  }
}

// renders text leaf marks (bold, italic, strikethrough, inline code).
export function Leaf({ attributes, children, leaf }: RenderLeafProps) {
  const text = leaf as CustomText;
  let node = children;

  if (text.bold) node = <strong>{node}</strong>;
  if (text.italic) node = <em>{node}</em>;
  if (text.strikethrough) node = <s>{node}</s>;
  if (text.code) node = <code>{node}</code>;

  return <span {...attributes}>{node}</span>;
}
