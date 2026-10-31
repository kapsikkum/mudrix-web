import { useCallback, useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useTranslation } from 'react-i18next';
import { ArrowsOutSimpleIcon, CodeIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { DownloadLink } from '@/app/components/DownloadLink/DownloadLink';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';
import { useToast } from '@/app/hooks/useToast';
import { isTauri, saveDesktopDownload } from '@/util/desktop';
import { fetchHead } from '@/util/fetchHead';
import { formatFileSize } from '@/util/format';
import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';
import { Modal } from '@/app/components/Modal';
import { useInView } from '@/app/hooks/useInView';
import * as css from '../Timeline.css';
import { zIndex } from '@/theme/zIndex';

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
    <Modal open onClose={onClose} title={filename} size="lg" zIndex={zIndex.dialogNested}>
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
/** The card only shows the start of the file; the rest is one click away in the expanded view. */
const CARD_PREVIEW_BYTES = 64 * 1024;
/** Copy takes at most this much of a larger file. */
const MAX_CARD_CHARS = 200_000;

function decodeHead(bytes: Uint8Array): string {
  // stream: true drops a multi-byte character cut off by the byte limit instead of showing U+FFFD.
  return new TextDecoder('utf-8').decode(bytes, { stream: true });
}

/**
 * Discord-style text file card: scrollable text, then a footer with name, size and actions.
 *
 * `src` is the whole file as a blob URL when it is already at hand (decrypted or cached). Without
 * it the card requests just the first 64 KB of `mxcUrl`, and the whole file is only downloaded if
 * the user expands or downloads it.
 */
export function TextFileCard({
  src,
  mxcUrl,
  client,
  filename,
  size,
}: {
  src: string | null;
  mxcUrl?: string;
  client?: MatrixClient;
  filename: string;
  size?: number;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [fullSrc, setFullSrc] = useState<string | null>(src);
  const [text, setText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fetchingFull, setFetchingFull] = useState(false);
  const [cardRef, inView] = useInView<HTMLDivElement>();

  useEffect(() => {
    if (src) setFullSrc(src);
  }, [src]);

  // Read only once the card is near the viewport; abort the read if it scrolls away first.
  useEffect(() => {
    if (!inView) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    const readBlob = (url: string) =>
      fetch(url, { signal })
        .then((r) => r.blob())
        .then((blob) => blob.slice(0, CARD_PREVIEW_BYTES).arrayBuffer())
        .then((buf) => decodeHead(new Uint8Array(buf)));
    const run = async () => {
      if (src) return readBlob(src);
      if (!mxcUrl || !client) return '';
      const httpUrl = mxcUrlToHttp(
        client,
        mxcUrl,
        undefined,
        undefined,
        'scale',
        false,
        true,
        true
      );
      const head = httpUrl
        ? await fetchHead(httpUrl, CARD_PREVIEW_BYTES, { token: client.getAccessToken(), signal })
        : null;
      if (head) return decodeHead(head);
      // The ranged request failed (or the server refuses it): fall back to the regular download.
      const blobUrl = await fetchMediaBlobUrl(mxcUrl, client, 1, undefined, undefined, undefined, {
        signal,
      });
      if (!blobUrl) return '';
      setFullSrc(blobUrl);
      return readBlob(blobUrl);
    };
    run()
      .then((value) => {
        if (!signal.aborted) setText(value);
      })
      .catch(() => {
        if (!signal.aborted) setText('');
      });
    return () => controller.abort();
  }, [src, mxcUrl, client, inView]);

  const ensureFull = useCallback(async (): Promise<string | null> => {
    if (fullSrc) return fullSrc;
    if (!mxcUrl || !client) return null;
    setFetchingFull(true);
    try {
      const url = await fetchMediaBlobUrl(mxcUrl, client, 1);
      if (url) setFullSrc(url);
      else toast.error(t('common.downloadFailed'));
      return url;
    } finally {
      setFetchingFull(false);
    }
  }, [fullSrc, mxcUrl, client, toast, t]);

  const handleExpand = () => {
    void ensureFull().then((url) => {
      if (url) setExpanded(true);
    });
  };

  const handleDownload = () => {
    void ensureFull().then((url) => {
      if (!url) return;
      if (isTauri()) {
        saveDesktopDownload(url, filename).then(
          (path) => toast.success(t('common.downloadSaved', { path })),
          () => toast.error(t('common.downloadFailed'))
        );
        return;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    });
  };

  const handleCopy = () => {
    if (!text) return;
    // The card only holds the start of the file, so copy takes the full text (capped).
    const full = ensureFull().then(async (url) => {
      if (!url) return text;
      const value = await fetch(url).then((r) => r.text());
      return value.slice(0, MAX_CARD_CHARS);
    });
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
              onClick={handleExpand}
              disabled={fetchingFull}
              aria-label={t('common.expand')}
            >
              <ArrowsOutSimpleIcon size={18} />
            </button>
          </Tooltip>
          <Tooltip content={t('mediaLightbox.download')}>
            {fullSrc ? (
              <DownloadLink
                href={fullSrc}
                filename={filename}
                className={css.textFileAction}
                aria-label={t('mediaLightbox.download')}
              >
                <DownloadSimpleIcon size={18} />
              </DownloadLink>
            ) : (
              <button
                type="button"
                className={css.textFileAction}
                onClick={handleDownload}
                disabled={fetchingFull}
                aria-label={t('mediaLightbox.download')}
              >
                <DownloadSimpleIcon size={18} />
              </button>
            )}
          </Tooltip>
        </span>
      </div>
      {expanded && fullSrc && (
        <FilePreviewModal
          src={fullSrc}
          filename={filename}
          kind="text"
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}
