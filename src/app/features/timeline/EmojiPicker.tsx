import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  SmileyIcon,
  UserIcon,
  PawPrintIcon,
  ForkKnifeIcon,
  AirplaneIcon,
  SoccerBallIcon,
  LightbulbIcon,
  HeartIcon,
  FlagIcon,
  ClockIcon,
  XIcon,
} from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { emojiPickerAtom, recentEmojiAtom } from '@/app/store/atoms';
import {
  getAllCategories,
  searchEmoji,
  type EmojiCategory,
  type EmojiItem,
  type CustomEmojiItem,
  type CustomPackCategory,
} from './emojiData';
import * as css from './EmojiPicker.css';

const PICKER_WIDTH = 352;
const PICKER_HEIGHT = 460;

const MAX_RECENT = 30;

interface RecentEntry {
  emoji: string;
  label: string;
  url?: string;
}

const EMOJI_NAV_ICONS: Record<string, React.ReactNode> = {
  'smileys-emotion': <SmileyIcon size={16} />,
  'people-body': <UserIcon size={16} />,
  'animals-nature': <PawPrintIcon size={16} />,
  'food-drink': <ForkKnifeIcon size={16} />,
  'travel-places': <AirplaneIcon size={16} />,
  activities: <SoccerBallIcon size={16} />,
  objects: <LightbulbIcon size={16} />,
  symbols: <HeartIcon size={16} />,
  flags: <FlagIcon size={16} />,
};

const RECENT_ID = 'recent';

interface EmojiPickerProps {
  embedded?: boolean;
  naked?: boolean;
  client?: MatrixClient;
  roomId?: string;
  onPick?: (emoji: string) => void;
  onClose?: () => void;
}

export function EmojiPicker({
  embedded,
  naked,
  client: propClient,
  roomId: propRoomId,
  onPick: propOnPick,
  onClose: propOnClose,
}: EmojiPickerProps) {
  const { t } = useTranslation();
  const [picker, setPicker] = useAtom(emojiPickerAtom);
  const [searchQuery, setSearchQuery] = useState('');
  const [skinToneEmoji, setSkinToneEmoji] = useState<{
    item: EmojiItem;
    rect: DOMRect;
  } | null>(null);
  const skinToneRef = useRef(skinToneEmoji);
  skinToneRef.current = skinToneEmoji;

  const [recent, setRecent] = useAtom(recentEmojiAtom);

  const saveRecent = useCallback(
    (emoji: string, label: string, url?: string) => {
      setRecent((prev) => {
        const next = prev.filter((r) => r.emoji !== emoji);
        next.unshift({ emoji, label, url });
        if (next.length > MAX_RECENT) next.length = MAX_RECENT;
        return next;
      });
    },
    [setRecent]
  );

  const ctx = embedded
    ? propClient && propRoomId && propOnPick && propOnClose
      ? { client: propClient, roomId: propRoomId, onPick: propOnPick, onClose: propOnClose }
      : null
    : picker;

  const close = useCallback(() => {
    if (embedded) {
      propOnClose?.();
    } else {
      setPicker(null);
    }
  }, [embedded, propOnClose, setPicker]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeNav, setActiveNav] = useState<string>(RECENT_ID);
  const wrapRef = useRef<HTMLDivElement>(null);

  const recentEmojis = useMemo(() => {
    if (searchQuery) return [];
    return recent;
  }, [recent, searchQuery]);

  const categories = useMemo(() => {
    if (!ctx) return [];
    return getAllCategories(ctx.client, ctx.roomId);
  }, [ctx]);

  const filteredCategories = useMemo(
    () => searchEmoji(searchQuery, categories),
    [searchQuery, categories]
  );

  useEffect(() => {
    if (ctx) {
      searchRef.current?.focus();
    }
  }, [ctx]);

  useEffect(() => {
    if (!ctx || naked) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (skinToneRef.current) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (skinToneRef.current) {
          setSkinToneEmoji(null);
        } else {
          close();
        }
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ctx, close, naked]);

  useEffect(() => {
    if (!bodyRef.current || searchQuery) return;
    const catIds = [...sectionRefs.current.keys()];
    if (catIds.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best = '';
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            best = entry.target.getAttribute('data-cat-id') ?? '';
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
  }, [filteredCategories, searchQuery, recent]);

  const handleNavClick = useCallback((catId: string) => {
    const el = sectionRefs.current.get(catId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleEmojiClick = useCallback(
    (item: EmojiItem) => {
      if (!ctx) return;
      if (item.skins && item.skins.length > 0) return;
      saveRecent(item.emoji, item.label);
      ctx.onPick(item.emoji);
      close();
    },
    [ctx, close, saveRecent]
  );

  const handleEmojiMouseDown = useCallback(
    (e: React.MouseEvent, item: EmojiItem) => {
      if (!ctx) return;
      if (item.skins && item.skins.length > 0) {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setSkinToneEmoji({ item, rect });
      }
    },
    [ctx]
  );

  const handleSkinTonePick = useCallback(
    (skin: EmojiItem) => {
      if (!ctx) return;
      saveRecent(skin.emoji, skin.label);
      ctx.onPick(skin.emoji);
      setSkinToneEmoji(null);
      close();
    },
    [ctx, close, saveRecent]
  );

  const handleCustomPick = useCallback(
    (emoji: CustomEmojiItem) => {
      if (!ctx) return;
      saveRecent(`:${emoji.shortcode}:`, emoji.shortcode, emoji.url);
      ctx.onPick(`:${emoji.shortcode}:`);
      close();
    },
    [ctx, close, saveRecent]
  );

  const handleRecentPick = useCallback(
    (entry: RecentEntry) => {
      if (!ctx) return;
      saveRecent(entry.emoji, entry.label, entry.url);
      ctx.onPick(entry.emoji);
      close();
    },
    [ctx, close, saveRecent]
  );

  const sectionRefCb = useCallback(
    (catId: string) => (el: HTMLDivElement | null) => {
      if (el) sectionRefs.current.set(catId, el);
      else sectionRefs.current.delete(catId);
    },
    []
  );

  const hasResults =
    recentEmojis.length > 0 || filteredCategories.some((cat) => cat.emojis.length > 0);

  if (!ctx) return null;

  const emojiContent = (
    <>
      {!searchQuery && recentEmojis.length > 0 && (
        <div ref={sectionRefCb(RECENT_ID)} data-cat-id={RECENT_ID} className={css.section}>
          <div className={css.sectionHeader}>{t('composer.recentEmoji', 'Recently used')}</div>
          <div className={css.grid}>
            {recentEmojis.map((entry) => (
              <button
                key={entry.emoji + (entry.url ?? '')}
                type="button"
                className={css.emojiItem}
                onClick={() => handleRecentPick(entry)}
                title={entry.emoji}
              >
                {entry.url ? (
                  <img
                    src={
                      ctx.client.mxcUrlToHttp(
                        entry.url,
                        22,
                        22,
                        undefined,
                        undefined,
                        undefined,
                        true
                      ) ?? ''
                    }
                    alt={entry.label}
                    className={css.emojiImg}
                    loading="lazy"
                  />
                ) : (
                  entry.emoji
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredCategories.map((cat) => {
        if (cat.emojis.length === 0) return null;

        if (cat.type === 'pack') {
          const packCat = cat as CustomPackCategory;
          return (
            <div
              key={cat.id}
              ref={sectionRefCb(cat.id)}
              data-cat-id={cat.id}
              className={css.section}
            >
              <div className={css.sectionHeader}>{cat.label}</div>
              <div className={css.grid}>
                {packCat.emojis.map((emo) => (
                  <button
                    key={emo.shortcode}
                    type="button"
                    className={css.emojiItem}
                    onClick={() => handleCustomPick(emo)}
                    title={`:${emo.shortcode}:`}
                  >
                    <img
                      src={
                        ctx.client.mxcUrlToHttp(
                          emo.url,
                          22,
                          22,
                          undefined,
                          undefined,
                          undefined,
                          true
                        ) ?? ''
                      }
                      alt={emo.shortcode}
                      className={css.emojiImg}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          );
        }

        const emojiCat = cat as EmojiCategory;
        return (
          <div key={cat.id} ref={sectionRefCb(cat.id)} data-cat-id={cat.id} className={css.section}>
            <div className={css.sectionHeader}>{cat.label}</div>
            <div className={css.grid}>
              {emojiCat.emojis.map((emoji) => (
                <button
                  key={emoji.hexcode}
                  type="button"
                  className={css.emojiItem}
                  onClick={() => handleEmojiClick(emoji)}
                  onMouseDown={(e) => handleEmojiMouseDown(e, emoji)}
                  title={emoji.label}
                >
                  {emoji.emoji}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!hasResults && (
        <div className={css.noResults}>{t('composer.noEmojiFound', 'No emoji found')}</div>
      )}
    </>
  );

  const navContent = (
    <>
      {recentEmojis.length > 0 && (
        <button
          key={RECENT_ID}
          type="button"
          className={`${css.navBtn} ${activeNav === RECENT_ID ? css.navBtnActive : ''}`}
          onClick={() => handleNavClick(RECENT_ID)}
          title={t('composer.recentEmoji', 'Recently used')}
        >
          <ClockIcon size={16} />
        </button>
      )}
      {filteredCategories.map((cat) => {
        let icon: React.ReactNode;
        if (cat.type === 'pack') {
          const first = (cat as CustomPackCategory).emojis[0];
          icon = first ? (
            <img
              src={
                ctx.client.mxcUrlToHttp(first.url, 18, 18, undefined, undefined, undefined, true) ??
                ''
              }
              alt=""
              className={css.navImg}
            />
          ) : (
            '📦'
          );
        } else {
          icon = EMOJI_NAV_ICONS[cat.id] ?? '❓';
        }
        return (
          <button
            key={cat.id}
            type="button"
            className={`${css.navBtn} ${activeNav === cat.id ? css.navBtnActive : ''}`}
            onClick={() => handleNavClick(cat.id)}
            title={cat.label}
          >
            {icon}
          </button>
        );
      })}
    </>
  );

  let positionStyle: React.CSSProperties | undefined;
  if (!embedded && picker) {
    const x = Math.min(picker.x, window.innerWidth - PICKER_WIDTH - 8);
    const y = picker.y + PICKER_HEIGHT > window.innerHeight ? picker.y - PICKER_HEIGHT : picker.y;
    positionStyle = { left: x, top: y };
  }

  return (
    <>
      <div
        ref={wrapRef}
        className={naked ? css.pickerWrapNaked : css.pickerWrap}
        style={naked ? undefined : positionStyle}
      >
        {naked ? (
          <div className={css.body}>
            <div className={css.bodyMain}>
              <div className={css.searchWrap}>
                <div className={css.searchInner}>
                  <input
                    ref={searchRef}
                    className={css.searchInput}
                    type="text"
                    placeholder={t('composer.searchEmoji')}
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
              <div ref={bodyRef} className={css.emojiBody}>
                {emojiContent}
              </div>
            </div>
            {!searchQuery && <div className={css.navSidebar}>{navContent}</div>}
          </div>
        ) : (
          <>
            <div className={css.searchWrap}>
              <div className={css.searchInner}>
                <input
                  ref={searchRef}
                  className={css.searchInput}
                  type="text"
                  placeholder={t('composer.searchEmoji')}
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
              {!embedded && (
                <button
                  type="button"
                  className={css.searchCloseBtn}
                  onClick={() => close()}
                  aria-label={t('common.close')}
                >
                  <XIcon size={16} weight="bold" />
                </button>
              )}
            </div>
            <div className={css.body}>
              <div ref={bodyRef} className={css.emojiBody}>
                {emojiContent}
              </div>
              {!searchQuery && <div className={css.navSidebar}>{navContent}</div>}
            </div>
          </>
        )}
      </div>

      {skinToneEmoji && (
        <SkinTonePicker
          item={skinToneEmoji.item}
          anchorRect={skinToneEmoji.rect}
          onPick={handleSkinTonePick}
          onClose={() => setSkinToneEmoji(null)}
        />
      )}
    </>
  );
}

interface SkinTonePickerProps {
  item: EmojiItem;
  anchorRect: DOMRect;
  onPick: (emoji: EmojiItem) => void;
  onClose: () => void;
}

function SkinTonePicker({ item, anchorRect, onPick, onClose }: SkinTonePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const variants = useMemo(() => {
    const result: EmojiItem[] = [];
    if (item.skins) {
      result.push({ ...item, skins: undefined });
      for (const skin of item.skins) {
        result.push({ ...skin, skins: undefined });
      }
    }
    return result;
  }, [item]);

  const popoverLeft = Math.min(anchorRect.left, window.innerWidth - variants.length * 36 - 8);
  const popoverTop = anchorRect.top - 44;

  return (
    <div ref={ref} className={css.skinTonePopover} style={{ left: popoverLeft, top: popoverTop }}>
      {variants.map((v) => (
        <button
          key={v.hexcode}
          type="button"
          className={css.skinToneBtn}
          onClick={() => onPick(v)}
          title={v.label}
        >
          {v.emoji}
        </button>
      ))}
    </div>
  );
}
