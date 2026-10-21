import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowsOutSimpleIcon, CodeIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { formatFileSize } from '@/util/format';
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

/** Larger text files are shown as a plain file card instead of an inline preview. */
export const TEXT_CARD_MAX_BYTES = 5 * 1024 * 1024;
const MAX_CARD_CHARS = 200_000;

/** Discord-style text file card: scrollable text, then a footer with name, size and actions. */
export function TextFileCard({
  src,
  filename,
  size,
}: {
  src: string;
  filename: string;
  size?: number;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => r.text())
      .then((value) => {
        if (!cancelled) setText(value.slice(0, MAX_CARD_CHARS));
      })
      .catch(() => {
        if (!cancelled) setText('');
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div className={css.textFileCard}>
      {text ? <pre className={css.textFileBody}>{text}</pre> : null}
      <div className={css.textFileFooter}>
        <span className={css.textFileInfo}>
          <span className={css.textFileName}>{filename}</span>
          {size !== undefined && <span className={css.textFileSize}>{formatFileSize(size)}</span>}
        </span>
        <span className={css.textFileActions}>
          <Tooltip content={copied ? t('common.copied') : t('common.copy')}>
            <button
              type="button"
              className={css.textFileAction}
              onClick={handleCopy}
              aria-label={t('common.copy')}
            >
              <CodeIcon size={18} />
            </button>
          </Tooltip>
          <Tooltip content={t('common.expand')}>
            <button
              type="button"
              className={css.textFileAction}
              onClick={() => setExpanded(true)}
              aria-label={t('common.expand')}
            >
              <ArrowsOutSimpleIcon size={18} />
            </button>
          </Tooltip>
          <Tooltip content={t('mediaLightbox.download')}>
            <a
              href={src}
              download={filename}
              className={css.textFileAction}
              aria-label={t('mediaLightbox.download')}
            >
              <DownloadSimpleIcon size={18} />
            </a>
          </Tooltip>
        </span>
      </div>
      {expanded && (
        <FilePreviewModal
          src={src}
          filename={filename}
          kind="text"
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}
