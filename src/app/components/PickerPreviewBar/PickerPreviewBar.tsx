import type { MatrixClient } from 'matrix-js-sdk';
import { AuthMediaImg } from '@/app/components/AuthMediaImg';
import * as css from './PickerPreviewBar.css';

export type PreviewItem =
  | { kind: 'emoji'; emoji: string; shortcode: string | null; label?: string }
  | { kind: 'image'; url: string; shortcode: string; label?: string };

interface Props {
  client?: MatrixClient | null;
  item: PreviewItem | null;
}

export function PickerPreviewBar({ client, item }: Props) {
  if (!item) return null;

  return (
    <div className={css.bar} aria-hidden="true">
      {item.kind === 'image' ? (
        <AuthMediaImg client={client} mxcUrl={item.url} alt="" className={css.image} />
      ) : (
        <span className={css.emoji}>{item.emoji}</span>
      )}
      <span className={css.text}>{item.shortcode ?? item.label ?? ''}</span>
    </div>
  );
}
