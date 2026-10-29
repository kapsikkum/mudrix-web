import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowsOutSimpleIcon, CodeIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { DownloadLink } from '@/app/components/DownloadLink/DownloadLink';
import { formatFileSize } from '@/util/format';
import { Modal } from '@/app/components/Modal';
import { useInView } from '@/app/hooks/useInView';
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
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);

  // The blob's MIME type comes from the uploader (server Content-Type), so a "PDF" served as
  // text/html would run script in the app origin. Re-wrap the bytes as application/pdf and never
  // hand the original blob URL to the iframe.
  useEffect(() => {
    if (kind !== 'pdf') return undefined;
    let cancelled = false;
    let objectUrl: string | undefined;
    setPdfSrc(null);
    fetch(src)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setPdfSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, kind]);

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
        pdfSrc && <iframe src={pdfSrc} title={filename} className={css.filePreviewFrame} />
      ) : (
        <pre className={css.filePreviewText}>{text ?? ''}</pre>
      )}
    </Modal>
  );
}

/** Larger text files are shown as a plain file card instead of an inline preview. */
export const TEXT_CARD_MAX_BYTES = 5 * 1024 * 1024;
const MAX_CARD_CHARS = 200_000;
/** The card only previews the start of a file. */
const PREVIEW_BYTES = 64 * 1024;

function joinChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Reads the first PREVIEW_BYTES of a file and cancels the rest of the body. The stream is cut
 * here even if the server ignores the Range header.
 */
async function fetchPreview(
  src: string,
  signal: AbortSignal
): Promise<{ text: string; truncated: boolean }> {
  const res = await fetch(src, { headers: { Range: `bytes=0-${PREVIEW_BYTES - 1}` }, signal });
  if (!res.body) return { text: '', truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < PREVIEW_BYTES) {
      const result = await reader.read();
      if (result.done) {
        return { text: new TextDecoder().decode(joinChunks(chunks, total)), truncated: false };
      }
      const part = result.value.subarray(0, PREVIEW_BYTES - total);
      chunks.push(part);
      total += part.byteLength;
    }
    // {stream: true} drops a multi-byte character cut at the boundary instead of garbling it.
    const text = new TextDecoder().decode(joinChunks(chunks, total), { stream: true });
    return { text, truncated: true };
  } finally {
    reader.cancel().catch(() => {});
  }
}

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
  const [cardRef, inView] = useInView<HTMLDivElement>();
  const [preview, setPreview] = useState<{ text: string; truncated: boolean } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Read only once the card is near the viewport; abort the read if it scrolls away first.
  useEffect(() => {
    if (!inView) return undefined;
    const controller = new AbortController();
    fetchPreview(src, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setPreview(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreview({ text: '', truncated: false });
      });
    return () => controller.abort();
  }, [src, inView]);

  const handleCopy = () => {
    if (!preview?.text) return;
    // The preview is only the start of the file, so copy fetches the full text (same cap as before).
    const full = preview.truncated
      ? fetch(src)
          .then((r) => r.text())
          .then((value) => value.slice(0, MAX_CARD_CHARS))
      : Promise.resolve(preview.text);
    full
      .then(async (value) => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div className={css.textFileCard} ref={cardRef}>
      {preview?.text ? (
        <pre className={css.textFileBody}>
          {preview.text}
          {preview.truncated ? '\n…' : null}
        </pre>
      ) : null}
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
            <DownloadLink
              href={src}
              filename={filename}
              className={css.textFileAction}
              aria-label={t('mediaLightbox.download')}
            >
              <DownloadSimpleIcon size={18} />
            </DownloadLink>
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
