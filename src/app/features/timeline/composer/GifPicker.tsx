import {
  Fragment,
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useSwipeDownDismiss } from '@/app/hooks/useSwipeDownDismiss';
import { PANEL_OVERLAY_QUERY } from '@/const/breakpoints';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import { XIcon, SpinnerGapIcon, StarIcon } from '@phosphor-icons/react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { Tooltip } from '@/app/components/Tooltip';
import { useCoarsePointer } from '@/app/hooks/useCoarsePointer';
import { decryptMediaFile } from '@/app/features/timeline/encryptedMedia';
import { AuthMediaImg } from '@/app/components/AuthMediaImg';
import { gifProviderAtom } from '@/app/store/atoms';
import { sendGif } from './sendGif';
import { getErrorMessage } from '@/util/error';
import { STORAGE_KEY_GIF_RECENT } from '@/const/storageKeys';
import { accountStorageKey } from '@/const/accountStorage';
import {
  FAVOURITES_CAP,
  parseFavourite,
  readFavourites,
  writeFavourites,
  favouriteKey,
  sameGif,
} from './gifFavourites';
import {
  GIF_PROVIDER_IDS,
  GifNotConfiguredError,
  GifRateLimitedError,
  getGifProvider,
  isGifProviderConfigured,
  isAbortError,
  parseGifProviderId,
  type GifItem,
  type GifProviderId,
} from './gifProviders';
import * as css from './GifPicker.css';

const RECENT_CAP = 60;

function EncryptedFavouriteThumb({
  client,
  file,
  mimeType,
  onLoad,
}: {
  client: MatrixClient;
  file: NonNullable<GifItem['mxcFile']>;
  mimeType?: string;
  onLoad: (w: number, h: number) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    decryptMediaFile(client, file, mimeType)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client, file, mimeType]);
  if (!src) return null;
  return (
    <img
      className={css.gifImg}
      src={src}
      alt=""
      onLoad={(e) => onLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
    />
  );
}

function readList(storageKey: string): GifItem[] {
  try {
    const raw = localStorage.getItem(accountStorageKey(storageKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const items: GifItem[] = [];
    for (const entry of parsed) {
      const item = parseFavourite(entry);
      if (!item) continue;
      const key = favouriteKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    return items;
  } catch {
    return [];
  }
}

function writeList(storageKey: string, list: GifItem[], cap: number): void {
  try {
    localStorage.setItem(accountStorageKey(storageKey), JSON.stringify(list.slice(0, cap)));
  } catch {
    // ignore
  }
}

const itemKey = favouriteKey;

type FeedError = 'rateLimited' | 'failed' | 'notConfigured' | null;

function toFeedError(err: unknown): FeedError {
  if (err instanceof GifRateLimitedError) return 'rateLimited';
  if (err instanceof GifNotConfiguredError) return 'notConfigured';
  return 'failed';
}
type Tab = GifProviderId | 'saved' | 'recent';

interface Feed {
  query: string;
  /** Query the current items were loaded for. */
  loadedSig: string | null;
  items: GifItem[];
  nextCursor: number | null;
  loading: boolean;
  error: FeedError;
}

const EMPTY_FEED: Feed = {
  query: '',
  loadedSig: null,
  items: [],
  nextCursor: null,
  loading: false,
  error: null,
};

function isProviderTab(tab: Tab): tab is GifProviderId {
  return tab === 'giphy' || tab === 'klipy';
}

interface Props {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
  naked?: boolean;
  onClose: () => void;
  onStatusChange?: (sending: boolean) => void;
  replyTo?: MatrixEvent | null;
  onReplySent?: () => void;
}

export function GifPicker({
  client,
  roomId,
  threadId,
  naked,
  onClose,
  onStatusChange,
  replyTo,
  onReplySent,
}: Props) {
  const { t } = useTranslation();
  const coarse = useCoarsePointer();
  const providerPref = useAtomValue(gifProviderAtom);
  const setProviderPref = useSetAtom(gifProviderAtom);
  // A provider is disabled when no API key was embedded in this build.
  const providerDisabled = useCallback((id: GifProviderId) => !isGifProviderConfigured(id), []);

  const [tab, setTab] = useState<Tab>(() => parseGifProviderId(providerPref));
  const [feeds, setFeeds] = useState<Record<GifProviderId, Feed>>({
    giphy: EMPTY_FEED,
    klipy: EMPTY_FEED,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [favourites, setFavourites] = useState<GifItem[]>(() => readFavourites());
  const [recent, setRecent] = useState<GifItem[]>(() => readList(STORAGE_KEY_GIF_RECENT));
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawer = useMediaQuery(PANEL_OVERLAY_QUERY);
  useSwipeDownDismiss({ enabled: drawer && !naked, sheetRef: wrapRef, onClose });
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const abortRef = useRef<AbortController | null>(null);
  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;
  const toast = useToast();

  const onProviderTab = isProviderTab(tab);
  const activeProvider: GifProviderId = isProviderTab(tab) ? tab : parseGifProviderId(providerPref);
  const feed = isProviderTab(tab) ? feeds[tab] : EMPTY_FEED;
  const activeQuery = feed.query.trim();

  const patchFeed = useCallback((id: GifProviderId, patch: Partial<Feed>) => {
    setFeeds((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const selectTab = useCallback(
    (next: Tab) => {
      if (isProviderTab(next)) {
        if (providerDisabled(next)) return;
        setProviderPref(next);
      }
      setTab(next);
    },
    [providerDisabled, setProviderPref]
  );

  // If the selected provider turns out to be unconfigured, fall back to the other one.
  useEffect(() => {
    if (isProviderTab(tab) && providerDisabled(tab)) {
      const other = GIF_PROVIDER_IDS.find((id) => !providerDisabled(id));
      if (other) setTab(other);
    }
  }, [tab, providerDisabled]);

  // Load trending (empty query) or search results for the active provider tab. Each provider
  // keeps its own query/results, so switching back is instant when they are already loaded.
  // Switching tabs aborts the in-flight request (effect cleanup) and resets paging.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoadingMore(false);
    if (!isProviderTab(tab) || providerDisabled(tab)) return undefined;
    const id = tab;
    const sig = activeQuery;
    if (feedsRef.current[id].loadedSig === sig) return undefined;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    patchFeed(id, { items: [], nextCursor: null, loading: true, error: null });
    const impl = getGifProvider(id);
    const timer = setTimeout(
      async () => {
        try {
          const opts = { signal: ctrl.signal };
          const page = activeQuery
            ? await impl.search(activeQuery, opts)
            : await impl.trending(opts);
          if (ctrl.signal.aborted) return;
          patchFeed(id, {
            items: page.items,
            nextCursor: page.nextCursor,
            loadedSig: sig,
            loading: false,
          });
        } catch (err) {
          if (ctrl.signal.aborted || isAbortError(err)) return;
          patchFeed(id, {
            loading: false,
            loadedSig: sig,
            error: toFeedError(err),
          });
        }
      },
      activeQuery ? 400 : 0
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [tab, activeQuery, providerDisabled, patchFeed]);

  const loadMore = useCallback(async () => {
    const ctrl = abortRef.current;
    if (!isProviderTab(tab) || !ctrl || ctrl.signal.aborted || loadingMore) return;
    const current = feedsRef.current[tab];
    if (current.nextCursor === null || current.loading || current.error) return;
    const id = tab;
    setLoadingMore(true);
    try {
      const impl = getGifProvider(id);
      const opts = { signal: ctrl.signal, cursor: current.nextCursor };
      const page = activeQuery ? await impl.search(activeQuery, opts) : await impl.trending(opts);
      if (ctrl.signal.aborted) return;
      setFeeds((prev) => {
        const seen = new Set(prev[id].items.map((i) => i.id));
        return {
          ...prev,
          [id]: {
            ...prev[id],
            items: [...prev[id].items, ...page.items.filter((i) => !seen.has(i.id))],
            nextCursor: page.nextCursor,
          },
        };
      });
    } catch (err) {
      if (ctrl.signal.aborted || isAbortError(err)) return;
      patchFeed(id, { error: toFeedError(err) });
    }
    setLoadingMore(false);
  }, [tab, loadingMore, activeQuery, patchFeed]);

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  const canLoadMore =
    onProviderTab && !feed.loading && !feed.error && feed.nextCursor !== null && !loadingMore;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!canLoadMore || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root: gridRef.current, rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canLoadMore, loadMore]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, [tab]);

  useEffect(() => {
    writeFavourites(favourites);
  }, [favourites]);

  useEffect(() => {
    if (naked) return undefined;
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

  const sendImage = useCallback(
    async (item: GifItem) => {
      // Record in Recent synchronously: onClose() below may unmount the picker.
      const key = itemKey(item);
      const nextRecent = [
        item,
        ...readList(STORAGE_KEY_GIF_RECENT).filter((r) => itemKey(r) !== key),
      ].slice(0, RECENT_CAP);
      writeList(STORAGE_KEY_GIF_RECENT, nextRecent, RECENT_CAP);
      setRecent(nextRecent);
      onClose();
      onStatusChange?.(true);
      try {
        await sendGif(item, { client, roomId, threadId, replyTo });
        if (replyTo) onReplySent?.();
      } catch (err) {
        toast.error(t('room.settings.widgets.stickerSendFailed', { error: getErrorMessage(err) }));
      } finally {
        onStatusChange?.(false);
      }
    },
    [client, roomId, threadId, onClose, onStatusChange, replyTo, onReplySent, toast, t]
  );

  const isFavourite = useCallback(
    (item: GifItem) => favourites.some((f) => sameGif(f, item)),
    [favourites]
  );

  const toggleFavourite = useCallback((item: GifItem) => {
    setFavourites((prev) => {
      if (prev.some((f) => sameGif(f, item))) return prev.filter((f) => !sameGif(f, item));
      return [item, ...prev].slice(0, FAVOURITES_CAP);
    });
  }, []);

  const getAspect = (item: GifItem): number =>
    item.width > 0 && item.height > 0 ? item.width / item.height : (aspects[itemKey(item)] ?? 1);

  let displayItems: GifItem[] = recent;
  if (isProviderTab(tab)) displayItems = feed.items;
  else if (tab === 'saved') displayItems = favourites;

  // Remember each item's index so keyboard navigation follows list order.
  const indexOf = new Map<string, number>();
  displayItems.forEach((item, i) => indexOf.set(itemKey(item), i));

  const buildColumns = (list: GifItem[]): [GifItem[], GifItem[]] => {
    const col1: GifItem[] = [];
    const col2: GifItem[] = [];
    let h1 = 0;
    let h2 = 0;
    for (const item of list) {
      const aspect = getAspect(item);
      if (h1 <= h2) {
        col1.push(item);
        h1 += aspect;
      } else {
        col2.push(item);
        h2 += aspect;
      }
    }
    return [col1, col2];
  };

  const focusTile = (idx: number): boolean => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-gif-idx="${idx}"]`);
    if (!el) return false;
    el.focus();
    return true;
  };

  const focusAboveGrid = () => {
    if (searchRef.current) searchRef.current.focus();
    else tabRefs.current[tab]?.focus();
  };

  const onTileKeyDown = (e: ReactKeyboardEvent<HTMLElement>, item: GifItem) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      sendImage(item);
      return;
    }
    const idx = indexOf.get(itemKey(item)) ?? 0;
    let target: number | null = null;
    if (e.key === 'ArrowRight') target = idx + 1;
    else if (e.key === 'ArrowLeft') target = idx - 1;
    else if (e.key === 'ArrowDown') target = idx + 2;
    else if (e.key === 'ArrowUp') target = idx - 2;
    if (target === null) return;
    e.preventDefault();
    if (target < 0) focusAboveGrid();
    else focusTile(target);
  };

  const renderItem = (item: GifItem) => {
    const fav = isFavourite(item);
    const full = !fav && favourites.length >= FAVOURITES_CAP;
    let favLabel = t('composer.addFavourite');
    if (fav) favLabel = t('composer.removeFavourite');
    else if (full) favLabel = t('composer.favouritesFull');
    const itemProviderName =
      item.mxcUrl || item.mxcFile
        ? t('composer.gifSourceMessage')
        : getGifProvider(item.provider).displayName;
    const onThumbLoadDims = (w: number, h: number) => {
      if (item.width > 0 && item.height > 0) return;
      if (w > 0 && h > 0) {
        const ar = w / h;
        const key = itemKey(item);
        setAspects((prev) => (prev[key] === ar ? prev : { ...prev, [key]: ar }));
      }
    };
    return (
      <div
        key={itemKey(item)}
        className={css.gifItem}
        style={{ aspectRatio: String(getAspect(item)) }}
        role="button"
        tabIndex={0}
        data-gif-idx={indexOf.get(itemKey(item))}
        aria-label={`${item.title || t('composer.gif')} (${t('composer.gifSourceTag', { provider: itemProviderName })})`}
        onClick={() => sendImage(item)}
        onKeyDown={(e) => onTileKeyDown(e, item)}
      >
        {/* Homeserver-sourced thumbnails need an authenticated fetch, not a plain <img src>. */}
        {item.mxcFile ? (
          <EncryptedFavouriteThumb
            client={client}
            file={item.mxcFile}
            mimeType={item.mxcInfo?.mimetype}
            onLoad={onThumbLoadDims}
          />
        ) : item.mxcUrl ? (
          <AuthMediaImg
            client={client}
            mxcUrl={item.mxcUrl}
            className={css.gifImg}
            alt=""
            onLoad={(e) =>
              onThumbLoadDims(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
            }
          />
        ) : (
          <img
            className={css.gifImg}
            src={item.thumbUrl}
            alt=""
            loading="lazy"
            onLoad={(e) =>
              onThumbLoadDims(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
            }
          />
        )}
        <span className={css.sourceTag} aria-hidden="true">
          {itemProviderName}
        </span>
        <Tooltip content={favLabel} placement="top">
          <button
            type="button"
            className={css.favBtn}
            data-active={fav}
            data-coarse={coarse}
            aria-disabled={full}
            onClick={(e) => {
              e.stopPropagation();
              if (full) return;
              toggleFavourite(item);
            }}
            aria-label={favLabel}
          >
            <StarIcon size={14} weight={fav ? 'fill' : 'regular'} />
          </button>
        </Tooltip>
      </div>
    );
  };

  const renderMasonry = (list: GifItem[]) => {
    const [col1, col2] = buildColumns(list);
    return (
      <div className={css.masonry}>
        <div className={css.masonryCol}>{col1.map(renderItem)}</div>
        <div className={css.masonryCol}>{col2.map(renderItem)}</div>
      </div>
    );
  };

  const attributionProviders: GifProviderId[] = isProviderTab(tab) ? [tab] : [...GIF_PROVIDER_IDS];

  const errorText = (e: FeedError) => {
    if (e === 'rateLimited') return t('composer.gifRateLimited');
    if (e === 'notConfigured') return t('composer.gifNotConfiguredTooltip');
    return t('composer.gifLoadFailed');
  };

  const renderFeedState = () => {
    if (!isProviderTab(tab)) {
      if (displayItems.length > 0) return null;
      return (
        <div className={css.emptyState}>
          {tab === 'saved' ? t('composer.noFavourites') : t('composer.noRecent')}
        </div>
      );
    }
    if (feed.loading) {
      return (
        <div className={css.loadingState}>
          <SpinnerGapIcon size={20} className="icon-spin" />
        </div>
      );
    }
    if (feed.error && feed.items.length === 0) {
      return <div className={css.emptyState}>{errorText(feed.error)}</div>;
    }
    if (feed.items.length === 0) {
      return (
        <div className={css.emptyState}>
          {activeQuery ? t('composer.noResults') : t('composer.searchGifsHint')}
        </div>
      );
    }
    return null;
  };

  const tabs: { id: Tab; label: string }[] = [
    ...GIF_PROVIDER_IDS.map((id) => ({ id: id as Tab, label: getGifProvider(id).displayName })),
    { id: 'saved', label: t('composer.gifTabSaved') },
    { id: 'recent', label: t('composer.gifTabRecent') },
  ];

  const onTabKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const enabled = tabs.filter((x) => !(isProviderTab(x.id) && providerDisabled(x.id)));
    const cur = enabled.findIndex((x) => x.id === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (cur + 1) % enabled.length;
    else if (e.key === 'ArrowLeft') next = (cur - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchRef.current) searchRef.current.focus();
      else focusTile(0);
      return;
    }
    if (next < 0) return;
    e.preventDefault();
    const { id } = enabled[next];
    selectTab(id);
    tabRefs.current[id]?.focus();
  };

  const providerName = getGifProvider(activeProvider).displayName;

  return (
    <div ref={wrapRef} className={naked ? css.popoverNaked : css.popover}>
      <div className={css.tabsSub} role="tablist" aria-label={t('composer.gifTabsLabel')}>
        {tabs.map(({ id, label }, i) => {
          const disabled = isProviderTab(id) && providerDisabled(id);
          const selected = tab === id;
          const button = (
            <button
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-disabled={disabled}
              tabIndex={selected ? 0 : -1}
              className={`${css.tabSub} ${selected ? css.tabSubActive : ''} ${disabled ? css.tabSubDisabled : ''}`}
              onClick={() => selectTab(id)}
              onKeyDown={onTabKeyDown}
            >
              {label}
            </button>
          );
          return (
            <Fragment key={id}>
              {i === GIF_PROVIDER_IDS.length && (
                <div className={css.tabsDivider} role="separator" />
              )}
              {disabled ? (
                <Tooltip content={t('composer.gifNotConfiguredTooltip')} placement="top">
                  {button}
                </Tooltip>
              ) : (
                button
              )}
            </Fragment>
          );
        })}
      </div>
      {isProviderTab(tab) ? (
        <div className={css.searchWrap}>
          <div className={css.searchInner}>
            <input
              ref={searchRef}
              className={css.searchInput}
              placeholder={
                activeProvider === 'klipy' ? t('composer.searchKlipy') : t('composer.searchGiphy')
              }
              aria-label={providerName}
              value={feed.query}
              onChange={(e) => patchFeed(tab, { query: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && focusTile(0)) e.preventDefault();
              }}
              autoFocus={!coarse}
            />
            <button
              type="button"
              className={css.searchClearBtn}
              onClick={() => {
                patchFeed(tab, { query: '' });
                searchRef.current?.focus();
              }}
              aria-label={t('common.clear')}
              style={{ visibility: feed.query ? 'visible' : 'hidden' }}
            >
              <XIcon size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className={css.tabTitle}>
          {tab === 'saved' ? t('composer.gifTabSaved') : t('composer.gifTabRecent')}
        </div>
      )}
      <div ref={gridRef} className={css.gridWrap}>
        {renderFeedState()}
        {displayItems.length > 0 &&
          !(isProviderTab(tab) && feed.loading) &&
          renderMasonry(displayItems)}
        {isProviderTab(tab) && !feed.loading && feed.error && feed.items.length > 0 && (
          <div className={css.emptyState}>{errorText(feed.error)}</div>
        )}
        {isProviderTab(tab) && !feed.loading && feed.nextCursor !== null && !feed.error && (
          <>
            <div ref={sentinelRef} className={css.scrollSentinel} />
            <div className={css.loadMoreWrap}>
              <button
                type="button"
                className={css.consentBtn}
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <SpinnerGapIcon size={14} className="icon-spin" />
                ) : (
                  t('composer.loadMore')
                )}
              </button>
            </div>
          </>
        )}
      </div>
      <div className={css.footer}>
        {attributionProviders.map((id) => (
          <span key={id}>
            {t('composer.poweredBy', { provider: getGifProvider(id).displayName })}
          </span>
        ))}
      </div>
    </div>
  );
}
