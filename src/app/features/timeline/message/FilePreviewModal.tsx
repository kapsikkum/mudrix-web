import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/app/components/Modal';
import * as css from '../Timeline.css';

export type FilePreviewKind = 'pdf' | 'text';

const TEXT_EXT = /\.(md|markdown|txt|log|json|csv)$/i;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

/** Which in-app preview, if any, suits an attachment. */
export function getFilePreviewKind(filename: string, mimetype?: string): FilePreviewKind | null {
  if (mimetype === 'application/pdf' || /\.pdf$/i.test(filename)) return 'pdf';
  if (TEXT_EXT.test(filename) || mimetype?.startsWith('text/')) return 'text';
  return null;
}

interface Props {
  src: string;
  filename: string;
  kind: FilePreviewKind;
  onClose: () => void;
}

/** Previews a PDF (browser viewer) or a text/Markdown file without downloading it. */
export function FilePreviewModal({ src, filename, kind, onClose }: Props) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== 'text') return undefined;
    let cancelled = false;
    fetch(src)
      .then((r) => r.blob())
      .then((blob) => blob.slice(0, MAX_TEXT_BYTES).text())
      .then((value) => {
        if (!cancelled) setText(value);
      })
      .catch(() => {
        if (!cancelled) setText('');
      });
    return () => {
      cancelled = true;
    };
  }, [src, kind]);

  return (
    <Modal open onClose={onClose} title={filename} size="lg" zIndex={7600}>
      {kind === 'pdf' ? (
        <iframe src={src} title={filename} className={css.filePreviewFrame} />
      ) : (
        <pre className={css.filePreviewText}>{text ?? ''}</pre>
      )}
    </Modal>
  );
}

const SNIPPET_LINES = 10;
const MAX_SNIPPET_BYTES = 512 * 1024;
const MAX_RENDERED_LINES = 2000;

/** Discord-style inline snippet of a text file: first lines with numbers, expandable. */
export function FileTextSnippet({ src, size }: { src: string; size?: number }) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (size !== undefined && size > MAX_SNIPPET_BYTES) return undefined;
    let cancelled = false;
    fetch(src)
      .then((r) => r.blob())
      .then((blob) => blob.slice(0, MAX_SNIPPET_BYTES).text())
      .then((value) => {
        if (!cancelled) setLines(value.split(/\r?\n/).slice(0, MAX_RENDERED_LINES));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src, size]);

  if (!lines || lines.every((l) => !l.trim())) return null;
  const shown = expanded ? lines : lines.slice(0, SNIPPET_LINES);
  const canExpand = lines.length > SNIPPET_LINES;
  return (
    <div className={css.fileSnippet}>
      <div className={expanded ? css.fileSnippetBodyOpen : css.fileSnippetBody}>
        {shown.map((line, i) => (
          <div key={i} className={css.fileSnippetLine}>
            <span className={css.fileSnippetNum}>{i + 1}</span>
            <span className={css.fileSnippetText}>{line || ' '}</span>
          </div>
        ))}
      </div>
      {canExpand && (
        <button
          type="button"
          className={css.fileSnippetToggle}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('common.collapse') : t('common.expand')}
        </button>
      )}
    </div>
  );
}
