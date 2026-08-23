import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { useCoarsePointer } from '@/app/hooks/useCoarsePointer';
import { uploadEncryptedFile, getImageDimensions } from '@/app/features/timeline/encryptedMedia';
import { getErrorMessage } from '@/util/error';
import * as css from './GifPicker.css';

const GIPHY_API_KEY = 'TGnndTV82UWqYITMnla1ZOiPBJBesE7x';
const GIPHY_API = 'https://api.giphy.com/v1/gifs';

interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_height: { url: string; width: string; height: string; size?: string };
    downsized?: { url: string; width: string; height: string; size?: string };
    original: { url: string; width: string; height: string; size?: string };
  };
}

interface Props {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
  naked?: boolean;
  onClose: () => void;
}

export function GifPicker({ client, roomId, threadId, naked, onClose }: Props) {
  const { t } = useTranslation();
  const coarse = useCoarsePointer();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GiphyGif[]>([]);
  const [trending, setTrending] = useState<GiphyGif[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const mounted = useRef(false);

  // Fetch trending GIFs on mount
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    (async () => {
      try {
        const res = await fetch(`${GIPHY_API}/trending?api_key=${GIPHY_API_KEY}&limit=30`);
        const data = await res.json();
        setTrending(data.data || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Search on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${GIPHY_API}/search?q=${encodeURIComponent(query)}&api_key=${GIPHY_API_KEY}&limit=30`
        );
        const data = await res.json();
        setResults(data.data || []);
      } catch {
        // ignore
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (naked) return;
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, naked]);

  const sendGif = useCallback(
    async (gif: GiphyGif) => {
      setSending(gif.id);
      try {
        const img = gif.images.downsized || gif.images.original;
        const res = await fetch(img.url);
        const blob = await res.blob();
        const file = new File([blob], `${gif.id}.gif`, { type: blob.type || 'image/gif' });

        const uploadResult = await uploadEncryptedFile(client, roomId, file);

        const mimetype = file.type || 'image/gif';
        const dims = await getImageDimensions(file);
        const info: Record<string, unknown> = {
          mimetype,
          size: file.size,
          is_animated: uploadResult.isAnimated ?? undefined,
        };
        if (dims) {
          info.w = dims.w;
          info.h = dims.h;
        }

        const content: Record<string, unknown> = {
          body: 'GIF',
          info,
        };
        if (uploadResult.file) {
          content.file = uploadResult.file;
        } else {
          content.url = uploadResult.url;
        }

        await client.sendEvent(roomId, threadId ?? null, EventType.Sticker, content as never);
        onClose();
      } catch (err) {
        toast.error(t('room.settings.widgets.stickerSendFailed', { error: getErrorMessage(err) }));
      }
      setSending(null);
    },
    [client, roomId, threadId, onClose, toast, t]
  );

  return (
    <div ref={wrapRef} className={naked ? css.popoverNaked : css.popover}>
      <div className={css.searchWrap}>
        <div className={css.searchInner}>
          <input
            className={css.searchInput}
            placeholder={t('composer.searchGifs')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus={!coarse}
          />
          <button
            type="button"
            className={css.searchClearBtn}
            onClick={() => setQuery('')}
            aria-label={t('common.clear')}
            style={{ visibility: query ? 'visible' : 'hidden' }}
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>
      <div className={css.gridWrap}>
        {!query.trim() && trending.length > 0 && (
          <>
            <div className={css.sectionLabel}>{t('composer.trending')}</div>
            <div className={css.grid}>
              {trending.map((gif) => (
                <button
                  key={gif.id}
                  className={css.gifItem}
                  onClick={() => sendGif(gif)}
                  disabled={sending === gif.id}
                >
                  <img
                    className={css.gifImg}
                    src={gif.images.fixed_height.url}
                    alt={gif.title}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </>
        )}
        {!query.trim() && trending.length === 0 && !searching && (
          <div className={css.emptyState}>{t('composer.searchGifsHint')}</div>
        )}
        {searching && (
          <div className={css.loadingState}>
            <SpinnerGapIcon size={20} className="icon-spin" />
          </div>
        )}
        {!searching && query.trim() && results.length === 0 && (
          <div className={css.emptyState}>{t('composer.noResults')}</div>
        )}
        {query.trim() && (
          <div className={css.grid}>
            {results.map((gif) => (
              <button
                key={gif.id}
                className={css.gifItem}
                onClick={() => sendGif(gif)}
                disabled={sending === gif.id}
              >
                <img
                  className={css.gifImg}
                  src={gif.images.fixed_height.url}
                  alt={gif.title}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
