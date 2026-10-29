import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  ArrowSquareOutIcon,
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  EyeSlashIcon,
  XIcon,
  YoutubeLogoIcon,
} from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { elementCallUiAtom } from '@/app/store/atoms/elementCall';
import {
  expectedPosition,
  watchActionsAtom,
  watchStateAtom,
  watchingVideoIdAtom,
  youtubeConsentAtom,
  youtubeWatchUrl,
  type WatchState,
} from './watchTogether';
import { useWatchSync } from './useWatchSync';
import { WatchTogetherDialog } from './WatchTogetherDialog';
import { WatchTogetherPlayer } from './WatchTogetherPlayer';
import * as css from './WatchTogetherWindow.css';

/** Keeps this much of the window on screen when it is dragged. */
const EDGE_PX = 40;

/** The name of whoever started the video, as the call's room knows them. */
function useStarterName(client: MatrixClient | null, roomId: string | null, userId: string) {
  return (roomId && client?.getRoom(roomId)?.getMember(userId)?.name) || userId;
}

/** A draggable window for the shared video, or an invitation to it until this device opts in. */
function WatchWindow({
  client,
  roomId,
  state,
}: {
  client: MatrixClient | null;
  roomId: string | null;
  state: WatchState;
}) {
  const { t } = useTranslation();
  const actions = useAtomValue(watchActionsAtom);
  const [watching, setWatching] = useAtom(watchingVideoIdAtom);
  const [consent, setConsent] = useAtom(youtubeConsentAtom);
  const [asking, setAsking] = useState(false);
  const [large, setLarge] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const name = useStarterName(client, roomId, state.startedBy);

  const inviteKey = `${state.startedBy}:${state.videoId}`;
  const isWatching = watching === state.videoId;

  // A new video asks again even if the last invitation was dismissed.
  useEffect(() => {
    setAsking(false);
  }, [inviteKey]);

  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const move = (ev: PointerEvent) => {
      setPos({
        x: Math.min(Math.max(ev.clientX - dx, EDGE_PX - rect.width), window.innerWidth - EDGE_PX),
        y: Math.min(Math.max(ev.clientY - dy, 0), window.innerHeight - EDGE_PX),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  if (!isWatching && dismissed === inviteKey) return null;

  const style = pos ? { left: pos.x, top: pos.y, right: 'auto' } : undefined;
  const openOnYouTube = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.href = youtubeWatchUrl(state.videoId, expectedPosition(state));
  };

  return (
    <div ref={windowRef} className={`${css.panel} ${large ? css.panelLarge : ''}`} style={style}>
      <div className={css.header} onPointerDown={onDragStart}>
        <span className={css.headerTitle}>
          <YoutubeLogoIcon size={14} weight="fill" />
          {t('voice.watchTogether.startedBy', { name })}
        </span>
        <span className={css.headerButtons}>
          {isWatching && (
            <Tooltip
              content={large ? t('voice.watchTogether.shrink') : t('voice.watchTogether.enlarge')}
            >
              <button
                type="button"
                className={css.headerButton}
                onClick={() => setLarge((v) => !v)}
                aria-label={
                  large ? t('voice.watchTogether.shrink') : t('voice.watchTogether.enlarge')
                }
              >
                {large ? <ArrowsInSimpleIcon size={14} /> : <ArrowsOutSimpleIcon size={14} />}
              </button>
            </Tooltip>
          )}
          <Tooltip content={t('voice.watchTogether.openOnYouTube')}>
            <a
              className={css.headerButton}
              href={youtubeWatchUrl(state.videoId)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('voice.watchTogether.openOnYouTube')}
              onClick={openOnYouTube}
            >
              <ArrowSquareOutIcon size={14} />
            </a>
          </Tooltip>
          <Tooltip
            content={
              isWatching ? t('voice.watchTogether.stopWatching') : t('voice.watchTogether.dismiss')
            }
          >
            <button
              type="button"
              className={css.headerButton}
              onClick={() => {
                setWatching(null);
                setDismissed(inviteKey);
              }}
              aria-label={
                isWatching
                  ? t('voice.watchTogether.stopWatching')
                  : t('voice.watchTogether.dismiss')
              }
            >
              <EyeSlashIcon size={14} />
            </button>
          </Tooltip>
          <Tooltip content={t('voice.watchTogether.stop')}>
            <button
              type="button"
              className={css.headerStop}
              onClick={() => actions?.stop()}
              aria-label={t('voice.watchTogether.stop')}
            >
              <XIcon size={14} weight="bold" />
            </button>
          </Tooltip>
        </span>
      </div>
      {isWatching ? (
        <WatchTogetherPlayer state={state} onUpdate={(p, at) => actions?.update(p, at)} />
      ) : asking ? (
        <div className={css.invite}>
          <p className={css.inviteTitle}>{t('voice.watchTogether.consentTitle')}</p>
          <p className={css.inviteBody}>{t('voice.watchTogether.consentBody')}</p>
          <div className={css.inviteActions}>
            <button type="button" className={css.inviteSecondary} onClick={() => setAsking(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={css.inviteButton}
              onClick={() => {
                setConsent(true);
                setWatching(state.videoId);
              }}
            >
              {t('voice.watchTogether.watch')}
            </button>
          </div>
        </div>
      ) : (
        <div className={css.invite}>
          <YoutubeLogoIcon size={36} weight="fill" className={css.inviteIcon} />
          <p className={css.inviteTitle}>{t('voice.watchTogether.startedVideo', { name })}</p>
          <button
            type="button"
            className={css.inviteButton}
            onClick={() => (consent ? setWatching(state.videoId) : setAsking(true))}
          >
            {t('voice.watchTogether.watch')}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Watch together for the call this device is in: keeps the shared state in step with the call's
 * room, and shows the window for the shared video and the dialog that starts one. Mount it once.
 */
export function WatchTogether({ client }: { client: MatrixClient | null }) {
  useWatchSync(client);
  const state = useAtomValue(watchStateAtom);
  const ui = useAtomValue(elementCallUiAtom);

  return (
    <>
      <WatchTogetherDialog />
      {state &&
        createPortal(
          <WatchWindow client={client} roomId={ui.roomId} state={state} />,
          document.body
        )}
    </>
  );
}
