import { useCallback } from 'react';
import { useAtomValue, useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  SpeakerHighIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  PhoneXIcon,
} from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { elementCallUiAtom, elementCallActionsAtom } from '@/app/store/atoms/elementCall';
import { currentSpaceIdAtom, currentRoomIdAtom } from '@/app/store/atoms/rooms';
import { sidebarViewAtom } from '@/app/store/atoms/ui';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { isDmRoom } from '@/util/matrix';
import * as css from './ElementCallBar.css';

export function ElementCallBar() {
  const { t } = useTranslation();
  const ui = useAtomValue(elementCallUiAtom);
  const actions = useAtomValue(elementCallActionsAtom);
  const currentRoomId = useAtomValue(currentRoomIdAtom);
  const [currentSpaceId] = useAtom(currentSpaceIdAtom);
  const [sidebarView] = useAtom(sidebarViewAtom);
  const navigate = useNavigate();

  const roomId = ui.roomId;
  const client = getMatrixClientOrNull();
  const room = roomId ? client?.getRoom(roomId) : null;
  const roomName = room?.name ?? roomId ?? '';

  const joined = ui.phase === 'joined';
  const CamIcon = ui.isVideoMuted ? VideoCameraSlashIcon : VideoCameraIcon;
  const videoTitle = ui.isVideoMuted ? t('voice.cameraOff') : t('voice.cameraOn');

  const openCall = useCallback(() => {
    if (!roomId) return;
    if (currentRoomId !== roomId) {
      const path =
        room && client && isDmRoom(room, client)
          ? `/dm/${encodeURIComponent(roomId)}`
          : `/r/${encodeURIComponent(roomId)}`;
      navigate(path, { state: { sidebarView, currentSpaceId } });
    }
    actions?.setPresentation('room');
  }, [roomId, room, client, currentRoomId, navigate, sidebarView, currentSpaceId, actions]);

  if (!roomId) return null;

  return (
    <div className={css.bar}>
      <div className={css.info}>
        <div className={css.statusRow}>
          <SpeakerHighIcon size={14} weight="fill" />
          <span className={css.callStatus}>
            {joined ? t('voice.statusConnected') : t('voice.statusConnecting')}
          </span>
        </div>
        <button type="button" className={css.callerName} onClick={openCall}>
          {roomName}
        </button>
      </div>

      <div className={css.controls}>
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
