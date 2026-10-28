import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  CellSignalHighIcon,
  DotsThreeIcon,
  MonitorArrowUpIcon,
  PhoneXIcon,
  SmileyIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
} from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { Popover } from '@/app/components/Popover';
import {
  elementCallUiAtom,
  elementCallActionsAtom,
  elementCallEmbedAtom,
} from '@/app/store/atoms/elementCall';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useReturnToCall } from './useReturnToCall';
import { useElementCallTileVisible } from './useElementCallParticipants';
import { CallStatsPopover } from './CallStatsPopover';
import { canShareScreen } from '@/util/desktop';
import * as css from './ElementCallBar.css';

/** Shown in the picker; the rest are behind "more". */
const QUICK_REACTIONS = ['👍', '👎', '👏', '🎉', '😄', '🥰', '👋', '🤘'];

// Element Call shows one reaction per person at a time, for 3 s, and drops any sent meanwhile.
const REACTION_COOLDOWN_MS = 3000;

/**
 * The call's own panel in the sidebar, above the user panel: status and room on top with a way to
 * leave, then the call actions (camera, screen share, reactions). Mic and deafen live in the user
 * panel below.
 */
export function ElementCallBar() {
  const { t } = useTranslation();
  const ui = useAtomValue(elementCallUiAtom);
  const actions = useAtomValue(elementCallActionsAtom);
  const embed = useAtomValue(elementCallEmbedAtom);
  const returnToCall = useReturnToCall();

  const roomId = ui.roomId;
  const client = getMatrixClientOrNull();
  const room = roomId ? client?.getRoom(roomId) : null;
  const roomName = room?.name ?? roomId ?? '';

  const joined = ui.phase === 'joined';
  const tileVisible = useElementCallTileVisible();
  const connected = joined && tileVisible;
  const CamIcon = ui.isVideoMuted ? VideoCameraSlashIcon : VideoCameraIcon;
  const videoTitle = ui.isVideoMuted ? t('voice.cameraOff') : t('voice.cameraOn');
  const shareTitle = ui.isScreenSharing ? t('voice.stopShare') : t('voice.shareScreen');
  const statusRef = useRef<HTMLButtonElement>(null);
  const reactRef = useRef<HTMLSpanElement>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [cooling, setCooling] = useState(false);

  useEffect(() => {
    if (!cooling) return undefined;
    const timer = window.setTimeout(() => setCooling(false), REACTION_COOLDOWN_MS);
    return () => window.clearTimeout(timer);
  }, [cooling]);

  if (!roomId) return null;

  // Our Element Call fork lists every reaction it has; with the npm package "more" opens EC's own.
  const ecReactions = embed?.control.getReactions() ?? null;
  const react = (emoji: string) => {
    if (cooling) return;
    setCooling(true);
    actions?.openReactions(emoji);
  };

  return (
    <div className={css.bar}>
      <div className={css.header}>
        <div className={css.info}>
          <button
            ref={statusRef}
            type="button"
            className={connected ? css.statusRow : css.statusRowConnecting}
            onClick={() => setStatsOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={statsOpen}
          >
            <CellSignalHighIcon size={14} weight="bold" />
            <span className={css.callStatus}>
              {connected ? t('voice.statusConnected') : t('voice.statusConnecting')}
            </span>
          </button>
          <CallStatsPopover
            open={statsOpen}
            onClose={() => setStatsOpen(false)}
            anchorRef={statusRef}
          />
          <button type="button" className={css.callerName} onClick={returnToCall}>
            {roomName}
          </button>
        </div>

        <Tooltip content={t('voice.hangup')}>
          <button
            type="button"
            className={css.leaveBtn}
            onClick={() => actions?.hangup()}
            aria-label={t('voice.hangup')}
          >
            <PhoneXIcon size={16} />
          </button>
        </Tooltip>
      </div>

      <div className={css.actions}>
        <Tooltip content={videoTitle}>
          <button
            type="button"
            className={ui.isVideoMuted ? css.actionBtn : css.actionBtnActive}
            onClick={() => actions?.toggleVideo()}
            aria-label={videoTitle}
            aria-pressed={!ui.isVideoMuted}
          >
            <CamIcon size={18} weight={ui.isVideoMuted ? 'regular' : 'fill'} />
          </button>
        </Tooltip>

        {canShareScreen() && (
          <Tooltip content={shareTitle}>
            <button
              type="button"
              className={ui.isScreenSharing ? css.actionBtnActive : css.actionBtn}
              onClick={() => actions?.toggleScreenshare()}
              aria-label={shareTitle}
              aria-pressed={ui.isScreenSharing}
            >
              <MonitorArrowUpIcon size={18} weight={ui.isScreenSharing ? 'fill' : 'regular'} />
            </button>
          </Tooltip>
        )}

        <span ref={reactRef} className={css.actionSlot}>
          <Tooltip content={t('voice.reactions')}>
            <button
              type="button"
              className={reactOpen ? css.actionBtnActive : css.actionBtn}
              onClick={() => setReactOpen((v) => !v)}
              aria-label={t('voice.reactions')}
              aria-haspopup="menu"
              aria-expanded={reactOpen}
              disabled={!connected}
            >
              <SmileyIcon size={18} />
            </button>
          </Tooltip>
        </span>
      </div>

      <Popover
        open={reactOpen}
        onClose={() => setReactOpen(false)}
        anchorRef={reactRef}
        placement="top"
        role="menu"
        dense
      >
        <div className={css.reactions} role="toolbar" aria-label={t('voice.reactions')}>
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={css.reactionBtn}
              onClick={() => react(emoji)}
              disabled={cooling}
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
          {ecReactions && (
            <button
              type="button"
              className={css.reactionBtn}
              onClick={() => embed?.control.toggleRaisedHand()}
              aria-label={t('voice.raiseHand')}
            >
              ✋
            </button>
          )}
          <button
            type="button"
            className={css.reactionBtn}
            onClick={() => {
              actions?.openReactions();
              setReactOpen(false);
            }}
            aria-label={t('voice.moreReactions')}
          >
            <DotsThreeIcon size={18} weight="bold" />
          </button>
        </div>
      </Popover>
    </div>
  );
}
