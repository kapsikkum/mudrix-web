import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { XIcon, SmileyIcon, StickerIcon, GifIcon } from '@phosphor-icons/react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { EmojiPicker } from '@/app/features/timeline/EmojiPicker';
import { GifPicker } from '@/app/features/timeline/composer/GifPicker';
import { GifConsentGate } from '@/app/features/timeline/composer/GifConsentGate';
import { NativeStickerPicker } from '@/app/features/widget/NativeStickerPicker';
import { useBackToClose } from '@/app/hooks/useBackToClose';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import * as css from './ComposerMediaPicker.css';

export type MediaTab = 'emoji' | 'sticker' | 'gif';

interface Props {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
  initialTab?: MediaTab;
  onPickEmoji?: (emoji: string, mxcUrl?: string) => void;
  onClose: () => void;
  onGifStatusChange?: (sending: boolean) => void;
  replyTo?: MatrixEvent | null;
  onReplySent?: () => void;
}

export function ComposerMediaPicker({
  client,
  roomId,
  threadId,
  initialTab,
  onPickEmoji,
  onClose,
  onGifStatusChange,
  replyTo,
  onReplySent,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<MediaTab>(initialTab ?? 'emoji');
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Phones get a bottom drawer with a backdrop instead of a popover above the composer.
  const drawer = useMediaQuery('(max-width: 768px), (pointer: coarse) and (max-width: 1100px)');

  useBackToClose(drawer, onClose);

  useEffect(() => {
    if (drawer) return undefined;
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, drawer]);

  const panel = (
    <div ref={wrapperRef} className={drawer ? css.wrapperDrawer : css.wrapper}>
      {drawer && <div className={css.drawerHandle} aria-hidden="true" />}
      <div className={css.header}>
        <div className={css.tabs}>
          <button
            type="button"
            className={`${css.tab} ${tab === 'emoji' ? css.tabActive : ''}`}
            onClick={() => setTab('emoji')}
          >
            <SmileyIcon size={16} weight={tab === 'emoji' ? 'fill' : 'regular'} />
            {t('composer.emoji')}
          </button>
          <button
            type="button"
            className={`${css.tab} ${tab === 'sticker' ? css.tabActive : ''}`}
            onClick={() => setTab('sticker')}
          >
            <StickerIcon size={16} />
            {t('composer.stickers')}
          </button>
          <button
            type="button"
            className={`${css.tab} ${tab === 'gif' ? css.tabActive : ''}`}
            onClick={() => setTab('gif')}
          >
            <GifIcon size={16} weight="bold" />
            GIF
          </button>
        </div>
        <button
          type="button"
          className={css.closeBtn}
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <XIcon size={16} weight="bold" />
        </button>
      </div>
      <div className={css.content}>
        {tab === 'emoji' && (
          <EmojiPicker
            embedded
            naked
            client={client}
            roomId={roomId}
            onPick={onPickEmoji ?? (() => {})}
            onClose={onClose}
          />
        )}
        {tab === 'sticker' && (
          <NativeStickerPicker
            naked
            client={client}
            roomId={roomId}
            threadId={threadId}
            onClose={onClose}
            replyTo={replyTo}
            onReplySent={onReplySent}
          />
        )}
        {tab === 'gif' && (
          <GifConsentGate>
            <GifPicker
              naked
              client={client}
              roomId={roomId}
              threadId={threadId}
              onClose={onClose}
              onStatusChange={onGifStatusChange}
              replyTo={replyTo}
              onReplySent={onReplySent}
            />
          </GifConsentGate>
        )}
      </div>
    </div>
  );

  if (!drawer) return panel;
  return createPortal(
    <>
      <div className={css.drawerBackdrop} onClick={onClose} aria-hidden="true" />
      {panel}
    </>,
    document.body
  );
}
