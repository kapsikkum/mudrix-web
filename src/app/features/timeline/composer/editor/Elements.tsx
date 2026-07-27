import { createContext, useContext } from 'react';
import type { RenderElementProps, RenderLeafProps } from 'slate-react';
import type { MatrixClient } from 'matrix-js-sdk';
import type { CustomElement, CustomText, EmoticonElement } from './types';

export const MatrixClientContext = createContext<MatrixClient | null>(null);

export function Element({ attributes, children, element }: RenderElementProps) {
  const el = element as CustomElement;
  const client = useContext(MatrixClientContext);

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
          onClick={(e) => e.preventDefault()}
        >
          {children}
        </a>
      );

    case 'mention':
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

    case 'emoticon': {
      const e = el as EmoticonElement;
      const src = client
        ? (client.mxcUrlToHttp(e.mxcUrl, 32, 32, undefined, undefined, undefined, true) ?? e.mxcUrl)
        : e.mxcUrl;
      return (
        <span
          {...attributes}
          contentEditable={false}
          style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
          <img
            src={src}
            alt={`:${e.shortcode}:`}
            title={e.shortcode}
            height={20}
            style={{ display: 'inline', verticalAlign: 'middle' }}
          />
          {children}
        </span>
      );
    }

    default:
      return <p {...attributes}>{children}</p>;
  }
}

export function Leaf({ attributes, children, leaf }: RenderLeafProps) {
  const text = leaf as CustomText;
  let node = children;

  if (text.bold) node = <strong>{node}</strong>;
  if (text.italic) node = <em>{node}</em>;
  if (text.strikethrough) node = <s>{node}</s>;
  if (text.code) node = <code>{node}</code>;

  return <span {...attributes}>{node}</span>;
}
