import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import type { StickerEventContent } from 'matrix-js-sdk/lib/@types/events';
import { roomState } from '@/util/matrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Tooltip } from '@/app/components/Tooltip';
import { useAtom } from 'jotai';
import { roomSettingsRoomIdAtom } from '@/app/store/atoms';
import * as css from './NativeStickerPicker.css';

const PONIES_ROOM_EMOTES = 'im.ponies.room_emotes';

interface StickerImage {
  shortcode: string;
  url: string;
  packName: string;
}

interface PackGroup {
  packName: string;
  stickers: StickerImage[];
}

interface Props {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
  onClose: () => void;
}

export function NativeStickerPicker({ client, roomId, threadId, onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [, setRoomSettingsId] = useAtom(roomSettingsRoomIdAtom);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeNav, setActiveNav] = useState('');

  const [grouped, setGrouped] = useState<PackGroup[]>([]);

  useEffect(() => {
    const room = client.getRoom(roomId);
    if (!room) return;
    const state = roomState(room);
    const raw = state?.getStateEvents(PONIES_ROOM_EMOTES);
    const events = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (events.length === 0) return;
    const packs: PackGroup[] = [];
    for (const ev of events) {
      const content = ev.getContent() as Record<string, unknown>;
      const pack = content?.pack as Record<string, unknown> | undefined;
      const packUsage = pack?.usage as string[] | undefined;
      const packName: string = (pack?.display_name as string) || ev.getStateKey() || '';
      const images = content?.images as
        | Record<string, { url: string; usage?: string[] }>
        | undefined;
      if (!images) continue;
      const stickers: StickerImage[] = [];
      for (const [shortcode, img] of Object.entries(images)) {
        const imgUsage = img.usage ?? packUsage ?? ['emoticon', 'sticker'];
        if (img.url && imgUsage.includes('sticker')) {
          stickers.push({ shortcode, url: img.url, packName });
        }
      }
      if (stickers.length > 0) {
        packs.push({ packName, stickers });
      }
    }
    setGrouped(packs);
  }, [client, roomId]);

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
        await client.sendEvent(roomId, threadId ?? null, EventType.Sticker, {
          body: sticker.shortcode,
          url: sticker.url,
          info: {
            w: 160,
            h: 160,
            mimetype: 'image/png',
          },
        } as StickerEventContent);
        onClose();
      } catch (err) {
        toast.error(t('room.settings.widgets.stickerSendFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, roomId, threadId, onClose, toast, t]
  );

  useEffect(() => {
    if (!wrapRef.current) return;
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
  }, [onClose]);

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
    setRoomSettingsId(roomId);
    onClose();
  }, [setRoomSettingsId, roomId, onClose]);

  const hasResults = filteredPacks.some((p) => p.stickers.length > 0);

  return (
    <div ref={wrapRef} className={css.popover}>
      <div className={css.searchWrap}>
        <input
          ref={searchRef}
          className={css.searchInput}
          type="text"
          placeholder={t('composer.searchStickers', 'Search stickers...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Tooltip content={t('common.clear')}>
          <button
            type="button"
            className={css.searchClearBtn}
            onClick={() => setSearchQuery('')}
            aria-label={t('common.clear', 'Clear')}
            style={{ visibility: searchQuery ? 'visible' : 'hidden' }}
          >
            <XIcon size={14} />
          </button>
        </Tooltip>
        <Tooltip content={t('common.close')}>
          <button
            type="button"
            className={css.searchClearBtn}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <XIcon size={16} weight="bold" />
          </button>
        </Tooltip>
      </div>

      <div className={css.body}>
        <div ref={bodyRef} className={css.stickerBody}>
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
                          48,
                          48,
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
        </div>

        {!searchQuery && filteredPacks.length > 0 && (
          <div className={css.navSidebar}>
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
                          18,
                          18,
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
          </div>
        )}
      </div>
    </div>
  );
}
