import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import type { StickerEventContent } from 'matrix-js-sdk/lib/@types/events';
import { roomState } from '@/util/matrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { useAtom } from 'jotai';
import { roomSettingsRoomIdAtom, roomSettingsTabAtom } from '@/app/store/atoms';
import * as css from './NativeStickerPicker.css';

const PONIES_ROOM_EMOTES = 'im.ponies.room_emotes';

interface StickerImage {
  shortcode: string;
  url: string;
  packName: string;
  body?: string;
  mimetype?: string;
  info?: Record<string, unknown>;
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
}

export function NativeStickerPicker({ client, roomId, threadId, naked, onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [, setRoomSettingsId] = useAtom(roomSettingsRoomIdAtom);
  const [, setRoomSettingsTab] = useAtom(roomSettingsTabAtom);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeNav, setActiveNav] = useState('');

  const [grouped, setGrouped] = useState<PackGroup[]>([]);

  const buildGrouped = useCallback(() => {
    const room = client.getRoom(roomId);
    if (!room) {
      setGrouped([]);
      return;
    }
    const state = roomState(room);
    const raw = state?.getStateEvents(PONIES_ROOM_EMOTES);
    const events = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const packs: PackGroup[] = [];
    for (const ev of events) {
      const content = ev.getContent() as Record<string, unknown>;
      const pack = content?.pack as Record<string, unknown> | undefined;
      const packUsage = pack?.usage as string[] | undefined;
      const packName: string = (pack?.display_name as string) || ev.getStateKey() || '';
      const images = content?.images as
        | Record<
            string,
            {
              url: string;
              usage?: string[];
              body?: string;
              mimetype?: string;
              info?: Record<string, unknown>;
            }
          >
        | undefined;
      if (!images) continue;
      const stickers: StickerImage[] = [];
      for (const [shortcode, img] of Object.entries(images)) {
        const effectiveUsage =
          Array.isArray(img.usage) && img.usage.length > 0
            ? img.usage
            : Array.isArray(packUsage) && packUsage.length > 0
              ? packUsage
              : ['emoticon', 'sticker'];
        if (img.url && effectiveUsage.includes('sticker')) {
          stickers.push({
            shortcode,
            url: img.url,
            packName,
            body: img.body,
            mimetype: img.mimetype,
            info: img.info,
          });
        }
      }
      if (stickers.length > 0) {
        packs.push({
          packName,
          stickers: stickers.slice().sort((a, b) => a.shortcode.localeCompare(b.shortcode)),
        });
      }
    }
    packs.sort((a, b) => a.packName.localeCompare(b.packName));
    setGrouped(packs);
  }, [client, roomId]);

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
        const info: Record<string, unknown> = { ...sticker.info };
        if (sticker.mimetype && !info.mimetype) info.mimetype = sticker.mimetype;
        await client.sendEvent(roomId, threadId ?? null, EventType.Sticker, {
          body: sticker.body ?? sticker.shortcode,
          url: sticker.url,
          info,
        } as StickerEventContent);
        onClose();
      } catch (err) {
        toast.error(t('room.settings.widgets.stickerSendFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, roomId, threadId, onClose, toast, t]
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
    searchRef.current?.focus();
  }, []);

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
          {searchQuery
            ? t('composer.noEmojiFound', 'No emoji found')
            : t('room.settings.emojis.noStickers')}
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
                  src={
                    client.mxcUrlToHttp(
                      sticker.url,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      true
                    ) ?? ''
                  }
                  alt={sticker.shortcode}
                  className={css.image}
                  loading="lazy"
                />
                <span className={css.label}>{sticker.shortcode}</span>
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
                src={
                  client.mxcUrlToHttp(
                    first.url,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    true
                  ) ?? ''
                }
                alt=""
                className={css.navImg}
              />
            ) : (
              '📦'
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
          placeholder={t('composer.searchStickers', 'Search stickers...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          type="button"
          className={css.searchClearBtn}
          onClick={() => setSearchQuery('')}
          aria-label={t('common.clear', 'Clear')}
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
          <div className={css.bodyMain}>
            {searchBar}
            <div ref={bodyRef} className={css.stickerBody}>
              {stickerContent}
            </div>
          </div>
          {!searchQuery && filteredPacks.length > 0 && (
            <div className={css.navSidebar}>{navContent}</div>
          )}
        </div>
      ) : (
        <>
          {searchBar}
          <div className={css.body}>
            <div ref={bodyRef} className={css.stickerBody}>
              {stickerContent}
            </div>
            {!searchQuery && filteredPacks.length > 0 && (
              <div className={css.navSidebar}>{navContent}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
