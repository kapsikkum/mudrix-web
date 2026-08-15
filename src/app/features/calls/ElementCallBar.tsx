import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  SpeakerHighIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  PhoneXIcon,
} from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { elementCallUiAtom, elementCallActionsAtom } from '@/app/store/atoms/elementCall';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import * as css from './ElementCallBar.css';

export function ElementCallBar() {
  const { t } = useTranslation();
  const ui = useAtomValue(elementCallUiAtom);
  const actions = useAtomValue(elementCallActionsAtom);

  if (!ui.roomId) return null;

  const client = getMatrixClientOrNull();
  const room = ui.roomId ? client?.getRoom(ui.roomId) : null;
  const roomName = room?.name ?? ui.roomId;

  const joined = ui.phase === 'joined';
  const MicIcon = ui.isMuted ? MicrophoneSlashIcon : MicrophoneIcon;
  const CamIcon = ui.isVideoMuted ? VideoCameraSlashIcon : VideoCameraIcon;
  const muteTitle = ui.isMuted ? t('voice.unmute') : t('voice.mute');
  const videoTitle = ui.isVideoMuted ? t('voice.cameraOff') : t('voice.cameraOn');

  return (
    <div className={css.bar}>
      <div className={css.info}>
        <div className={css.statusRow}>
          <SpeakerHighIcon size={14} weight="fill" />
          <span className={css.callStatus}>
            {joined ? t('voice.statusConnected') : t('voice.statusConnecting')}
          </span>
        </div>
        <div className={css.callerName}>{roomName}</div>
      </div>

      <div className={css.controls}>
        <Tooltip content={muteTitle}>
          <button
            type="button"
            className={ui.isMuted ? css.ctrlOff : css.ctrl}
            onClick={() => actions?.toggleMute()}
            aria-label={muteTitle}
          >
            {ui.isMuted ? <MicIcon size={16} /> : <MicIcon size={16} weight="fill" />}
          </button>
        </Tooltip>

        <Tooltip content={videoTitle}>
          <button
            type="button"
            className={ui.isVideoMuted ? css.ctrl : css.ctrlActive}
            onClick={() => actions?.toggleVideo()}
            aria-label={videoTitle}
          >
            {ui.isVideoMuted ? <CamIcon size={16} /> : <CamIcon size={16} weight="fill" />}
          </button>
        </Tooltip>

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
    </div>
  );
}
