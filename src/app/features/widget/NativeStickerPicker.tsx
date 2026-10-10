import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StickerIcon, XIcon } from '@phosphor-icons/react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import type { StickerEventContent } from 'matrix-js-sdk/lib/@types/events';
import { useToast } from '@/app/hooks/useToast';
import { useCoarsePointer } from '@/app/hooks/useCoarsePointer';
import { getErrorMessage } from '@/util/error';
import { useAtom } from 'jotai';
import { roomSettingsRoomIdAtom, roomSettingsTabAtom } from '@/app/store/atoms';
import { useStickerPacks } from '@/app/hooks/useUserPacks';
import {
  mergePackImageMap,
  mergePackInfo,
  readRoomPackEventsWithAncestors,
} from '@/app/features/settings/emojis/imagePackTypes';
import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';
import { getImageDimensions } from '@/app/features/timeline/encryptedMedia';
import { applyReplyMetadata } from '@/app/features/timeline/composer/sendMessageContent';
import * as css from './NativeStickerPicker.css';

interface StickerImage {
  shortcode: string;
  url: string;
  packName: string;
  body?: string;
  mimetype?: string;
  info?: Record<string, unknown>;
}

function hasDimensions(info: Record<string, unknown> | undefined): boolean {
  return typeof info?.w === 'number' && info.w > 0 && typeof info.h === 'number' && info.h > 0;
}

const measuredDims = new Map<string, { w: number; h: number }>();

function rememberDims(url: string, img: HTMLImageElement): void {
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    measuredDims.set(url, { w: img.naturalWidth, h: img.naturalHeight });
  }
}

async function resolveStickerInfo(
  client: MatrixClient,
  url: string,
  baseInfo: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (hasDimensions(baseInfo)) return baseInfo;
  const measured = measuredDims.get(url);
  if (measured) return { ...baseInfo, ...measured };
  try {
    const blobUrl = await fetchMediaBlobUrl(url, client);
    if (!blobUrl) return baseInfo;
    const blob = await fetch(blobUrl).then((res) => res.blob());
    const dims = await getImageDimensions(blob);
    if (!dims) return baseInfo;
    return {
      ...baseInfo,
      w: dims.w,
      h: dims.h,
      size: blob.size,
      mimetype: baseInfo.mimetype ?? blob.type,
    };
  } catch {
    return baseInfo;
  }
}

interface PackGroup {
  packName: string;
  stickers: StickerImage[];
}

interface Props {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
  naked?: boolean;
  onClose: () => void;
  replyTo?: MatrixEvent | null;
  onReplySent?: () => void;
}

export function NativeStickerPicker({
  client,
  roomId,
  threadId,
  naked,
  onClose,
  replyTo,
  onReplySent,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const coarse = useCoarsePointer();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [, setRoomSettingsId] = useAtom(roomSettingsRoomIdAtom);
  const [, setRoomSettingsTab] = useAtom(roomSettingsTabAtom);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeNav, setActiveNav] = useState('');

  const [grouped, setGrouped] = useState<PackGroup[]>([]);
  const stickerPacks = useStickerPacks(client);

  const buildGrouped = useCallback(() => {
    const room = client.getRoom(roomId);
    const byPackName = new Map<string, Map<string, StickerImage>>();

    const addSticker = (packName: string, sticker: StickerImage) => {
      const list = byPackName.get(packName) ?? new Map();
      if (list.has(sticker.shortcode)) return;
      list.set(sticker.shortcode, sticker);
      byPackName.set(packName, list);
    };

    const byStateKey = room
      ? readRoomPackEventsWithAncestors(room, client)
      : new Map<string, MatrixEvent[]>();
    for (const [stateKey, events] of byStateKey) {
      const contents = events.map((ev) => ev.getContent() as Record<string, unknown>);
      const info = mergePackInfo(...contents);
      const packName: string = info.displayName || stateKey;
      const packUsage = info.usage;
      for (const [shortcode, img] of Object.entries(mergePackImageMap(...contents))) {
        const effectiveUsage =
          Array.isArray(img.usage) && img.usage.length > 0
            ? img.usage
            : Array.isArray(packUsage) && packUsage.length > 0
              ? packUsage
              : ['emoticon', 'sticker'];
        if (img.url && effectiveUsage.includes('sticker')) {
          addSticker(packName, {
            shortcode,
            url: img.url,
            packName,
            body: img.body,
            mimetype: img.mimetype,
            info: img.info,
          });
        }
      }
    }

    for (const pack of stickerPacks) {
      for (const sticker of pack.stickers) {
        addSticker(pack.packName, {
          shortcode: sticker.shortcode,
          url: sticker.url,
          packName: pack.packName,
          body: sticker.body,
          mimetype: sticker.mimetype,
          info: sticker.info,
        });
      }
    }

    const packs: PackGroup[] = Array.from(byPackName.entries()).map(([packName, stickers]) => ({
      packName,
      stickers: Array.from(stickers.values()).sort((a, b) =>
        a.shortcode.localeCompare(b.shortcode)
      ),
    }));
    packs.sort((a, b) => a.packName.localeCompare(b.packName));
    setGrouped(packs);
  }, [client, roomId, stickerPacks]);

  useEffect(() => {
    buildGrouped();
    const room = client.getRoom(roomId);
    if (!room) return;
    const handle = () => buildGrouped();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    room.on('RoomState.events' as any, handle);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room.off('RoomState.events' as any, handle);
    };
  }, [buildGrouped, client, roomId]);

  const filteredPacks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return grouped;
    return grouped
      .map((pack) => {
        const filtered = pack.stickers.filter(
          (s) => s.shortcode.toLowerCase().includes(q) || pack.packName.toLowerCase().includes(q)
        );
        if (filtered.length === 0) return null;
        return { ...pack, stickers: filtered };
      })
      .filter(Boolean) as PackGroup[];
  }, [grouped, searchQuery]);

  const sendSticker = useCallback(
    async (sticker: StickerImage) => {
      try {
        const baseInfo: Record<string, unknown> = { ...sticker.info };
        if (sticker.mimetype && !baseInfo.mimetype) baseInfo.mimetype = sticker.mimetype;
        const info = await resolveStickerInfo(client, sticker.url, baseInfo);
        const content: Record<string, unknown> = {
          body: sticker.body ?? sticker.shortcode,
          url: sticker.url,
          info,
        };
        applyReplyMetadata(content, { replyTo, myId: client.getUserId() ?? '' });
        await client.sendEvent(
          roomId,
          threadId ?? null,
          EventType.Sticker,
          content as unknown as StickerEventContent
        );
        if (replyTo) onReplySent?.();
        onClose();
      } catch (err) {
        toast.error(t('room.settings.widgets.stickerSendFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, roomId, threadId, onClose, replyTo, onReplySent, toast, t]
  );

  useEffect(() => {
    if (naked || !wrapRef.current) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleMouse = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleMouse);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleMouse);
    };
  }, [onClose, naked]);

  useEffect(() => {
    if (!coarse) searchRef.current?.focus();
  }, [coarse]);

  useEffect(() => {
    if (!bodyRef.current || filteredPacks.length === 0 || searchQuery) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best = '';
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            best = entry.target.getAttribute('data-pack-id') ?? '';
            bestRatio = entry.intersectionRatio;
          }
        }
        if (best) setActiveNav(best);
      },
      { root: bodyRef.current, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    const els: Element[] = [];
    sectionRefs.current.forEach((el) => {
      observer.observe(el);
      els.push(el);
    });
    return () => {
      els.forEach((el) => observer.unobserve(el));
    };
  }, [filteredPacks, searchQuery]);

  const handleNavClick = useCallback((packName: string) => {
    const el = sectionRefs.current.get(packName);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const sectionRefCb = useCallback(
    (packName: string) => (el: HTMLDivElement | null) => {
      if (el) sectionRefs.current.set(packName, el);
      else sectionRefs.current.delete(packName);
    },
    []
  );

  const openRoomSettings = useCallback(() => {
    setRoomSettingsTab('emojis');
    setRoomSettingsId(roomId);
    onClose();
  }, [setRoomSettingsTab, setRoomSettingsId, roomId, onClose]);

  const hasResults = filteredPacks.some((p) => p.stickers.length > 0);

  const stickerContent = (
    <>
      {filteredPacks.length === 0 && !hasResults && (
        <div className={css.emptyState}>
          {searchQuery ? t('composer.noEmojiFound') : t('room.settings.emojis.noStickers')}
          <br />
          <button type="button" className={css.emptyLink} onClick={openRoomSettings}>
            {t('room.settings.emojis.title')}
          </button>
        </div>
      )}

      {filteredPacks.map((pack) => (
        <div
          key={pack.packName}
          ref={sectionRefCb(pack.packName)}
          data-pack-id={pack.packName}
          className={css.packSection}
        >
          <div className={css.packLabel}>{pack.packName}</div>
          <div className={css.grid}>
            {pack.stickers.map((sticker) => (
              <button
                key={sticker.shortcode}
                type="button"
                className={css.item}
                onClick={() => sendSticker(sticker)}
                title={sticker.shortcode}
              >
                <img
                  src={mxcUrlToHttp(
                    client,
                    sticker.url,
                    undefined,
                    undefined,
                    undefined,
                    false,
                    true,
                    true
                  )}
                  alt={sticker.shortcode}
                  className={css.image}
                  loading="lazy"
                  onLoad={(e) => rememberDims(sticker.url, e.currentTarget)}
                />
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  const navContent = (
    <>
      {filteredPacks.map((pack) => {
        const first = pack.stickers[0];
        return (
          <button
            key={pack.packName}
            type="button"
            className={`${css.navBtn} ${activeNav === pack.packName ? css.navBtnActive : ''}`}
            onClick={() => handleNavClick(pack.packName)}
            title={pack.packName}
          >
            {first ? (
              <img
                src={mxcUrlToHttp(
                  client,
                  first.url,
                  undefined,
                  undefined,
                  undefined,
                  false,
                  true,
                  true
                )}
                alt=""
                className={css.navImg}
              />
            ) : (
              <StickerIcon size={18} />
            )}
          </button>
        );
      })}
    </>
  );

  const searchBar = (
    <div className={css.searchWrap}>
      <div className={css.searchInner}>
        <input
          ref={searchRef}
          className={css.searchInput}
          type="text"
          placeholder={t('composer.searchStickers')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          type="button"
          className={css.searchClearBtn}
          onClick={() => setSearchQuery('')}
          aria-label={t('common.clear')}
          style={{ visibility: searchQuery ? 'visible' : 'hidden' }}
        >
          <XIcon size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} className={naked ? css.popoverNaked : css.popover}>
      {naked ? (
        <div className={css.body}>
          {!searchQuery && filteredPacks.length > 0 && (
            <div className={css.navSidebar}>{navContent}</div>
          )}
          <div className={css.bodyMain}>
            {searchBar}
            <div ref={bodyRef} className={css.stickerBody}>
              {stickerContent}
            </div>
          </div>
        </div>
      ) : (
        <>
          {searchBar}
          <div className={css.body}>
            {!searchQuery && filteredPacks.length > 0 && (
              <div className={css.navSidebar}>{navContent}</div>
            )}
            <div ref={bodyRef} className={css.stickerBody}>
              {stickerContent}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
