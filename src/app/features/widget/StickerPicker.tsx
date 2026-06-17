import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import { useAtom, useAtomValue } from 'jotai';
import {
  ClientWidgetApi,
  WidgetDriver,
  Widget,
  WidgetApiFromWidgetAction,
} from 'matrix-widget-api';
import { EventType } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import type { StickerEventContent } from 'matrix-js-sdk/lib/@types/events';
import { stickerPickerOpenAtom, themeAtom, ThemeName } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { STORAGE_KEY_STICKER_WIDGET_URL } from '@/const/storageKeys';
import * as css from './StickerPicker.css';

interface Props {
  client: MatrixClient;
  roomId: string;
  widgetUrl: string;
}

function getThemedUrl(base: string, appTheme: ThemeName): string {
  const configured = localStorage.getItem(STORAGE_KEY_STICKER_WIDGET_URL) ?? base;
  const sep = configured.includes('?') ? '&' : '?';
  const theme = appTheme === 'Ethereal' ? 'light' : 'dark';
  if (configured.includes('theme=')) return configured;
  return `${configured}${sep}theme=${theme}`;
}

// Minimal WidgetDriver subclass that grants sticker-sending capability
class StickerWidgetDriver extends WidgetDriver {
  async validateCapabilities() {
    return new Set<string>(['m.sticker']);
  }
}

export function StickerPicker({ client, roomId, widgetUrl }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(stickerPickerOpenAtom);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetApiRef = useRef<ClientWidgetApi | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const currentTheme = useAtomValue(themeAtom);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const setupWidgetApi = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const themedUrl = getThemedUrl(widgetUrl, currentTheme);
    const widget = new Widget({
      id: 'stickerpicker',
      creatorUserId: client.getUserId() ?? '@wizard:localhost',
      type: 'm.stickerpicker',
      url: themedUrl,
    });
    const driver = new StickerWidgetDriver();

    try {
      widgetApiRef.current?.stop?.();
      widgetApiRef.current = new ClientWidgetApi(widget, iframe, driver);
      widgetApiRef.current.on('ready', () => {});
    } catch {
      // Fallback: rely on raw postMessage listener below
    }

    setLoading(false);
  }, [widgetUrl, client, currentTheme]);

  useEffect(() => {
    if (!open) return;

    const handleMessage = async (ev: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || ev.source !== iframe.contentWindow) return;
      const data = ev.data;
      if (!data || data.api !== 'fromWidget') return;
      if (data.action !== 'm.sticker' && data.action !== WidgetApiFromWidgetAction.SendSticker)
        return;

      const stickerData = data.data;
      if (!stickerData) return;

      try {
        const content = stickerData.content ?? stickerData;
        const name: string = stickerData.name ?? content.body ?? 'Sticker';
        const url: string = content.url;
        const info = content.info ?? {};
        if (!url) return;

        const mimetype: string = info.mimetype ?? 'image/png';

        // send all content from stickerpicker as m.sticker
        await client.sendEvent(roomId, EventType.Sticker, {
          body: name,
          url,
          info: {
            w: info.w ?? 200,
            h: info.h ?? 200,
            mimetype,
            size: info.size ?? 0,
          },
        } as StickerEventContent);
        close();
      } catch (err) {
        toast.error(t('room.settings.widgets.stickerSendFailed', { error: getErrorMessage(err) }));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [open, client, roomId, close, toast, t]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        // Also allow the trigger button itself to close (it toggles the atom)
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Teardown widget API on close
  useEffect(() => {
    if (!open) {
      widgetApiRef.current?.stop?.();
      widgetApiRef.current = null;
      setLoading(true);
    }
  }, [open]);

  if (!open) return null;

  const themedUrl = getThemedUrl(widgetUrl, currentTheme);

  return (
    <div ref={wrapRef} className={css.popover}>
      <div className={css.header}>
        <span className={css.headerTitle}>{t('room.settings.widgets.stickers')}</span>
        <button
          type="button"
          className={css.closeBtn}
          onClick={close}
          aria-label={t('common.close')}
        >
          <XIcon size={16} />
        </button>
      </div>
      <div className={css.iframeWrap}>
        {loading && (
          <div className={css.loadingState}>
            <SpinnerGapIcon size={20} className="icon-spin" />
            <span>{t('common.loading')}</span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          className={css.iframe}
          src={themedUrl}
          allow="clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={t('room.settings.widgets.stickerPicker')}
          onLoad={setupWidgetApi}
        />
      </div>
    </div>
  );
}
