import { useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  CellSignalHighIcon,
  MonitorArrowUpIcon,
  PhoneXIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  YoutubeLogoIcon,
} from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { callUiAtom, callActionsAtom } from '@/app/store/atoms/call';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useReturnToCall } from './useReturnToCall';
import { useCallTileVisible } from './useCallParticipants';
import { CallStatsPopover } from './CallStatsPopover';
import { canShareScreen } from '@/util/desktop';
import { SoundboardButton } from '@/app/features/soundboard/SoundboardButton';
import { watchDialogOpenAtom, watchStateAtom } from './watchTogether/watchTogether';
import * as css from './ElementCallBar.css';

/**
 * The call's own panel in the sidebar, above the user panel: status and room on top with a way to
 * leave, then the call actions (camera, screen share, soundboard). Mic and deafen live in the user
 * panel below.
 */
export function ElementCallBar() {
  const { t } = useTranslation();
  const ui = useAtomValue(callUiAtom);
  const actions = useAtomValue(callActionsAtom);
  const returnToCall = useReturnToCall();
  const watching = useAtomValue(watchStateAtom) !== null;
  const setWatchDialogOpen = useSetAtom(watchDialogOpenAtom);

  const roomId = ui.roomId;
  const client = getMatrixClientOrNull();
  const room = roomId ? client?.getRoom(roomId) : null;
  const roomName = room?.name ?? roomId ?? '';

  const joined = ui.phase === 'joined';
  const tileVisible = useCallTileVisible();
  const connected = joined && tileVisible;
  const CamIcon = ui.isVideoMuted ? VideoCameraSlashIcon : VideoCameraIcon;
  const videoTitle = ui.isVideoMuted ? t('voice.cameraOff') : t('voice.cameraOn');
  const shareTitle = ui.isScreenSharing ? t('voice.stopShare') : t('voice.shareScreen');
  const statusRef = useRef<HTMLButtonElement>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  if (!roomId) return null;

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

        <Tooltip content={t('voice.watchTogether.button')}>
          <button
            type="button"
            className={watching ? css.actionBtnActive : css.actionBtn}
            onClick={() => setWatchDialogOpen(true)}
            aria-label={t('voice.watchTogether.button')}
            disabled={!connected}
          >
            <YoutubeLogoIcon size={18} weight={watching ? 'fill' : 'regular'} />
          </button>
        </Tooltip>

        <SoundboardButton
          buttonClass={css.actionBtn}
          activeClass={css.actionBtnActive}
          anchorClass={css.actionSlot}
          iconSize={18}
          fill
          disabled={!connected}
        />
      </div>
    </div>
  );
}
