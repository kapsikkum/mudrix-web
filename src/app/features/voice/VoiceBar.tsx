import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  BroadcastIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  PhoneDisconnectIcon,
} from '@phosphor-icons/react';
import { voiceStateAtom } from '@/app/store/atoms';
import * as css from './VoiceBar.css';

interface Props {
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export function VoiceBar({ onLeave, onToggleMute, onToggleVideo }: Props) {
  const { t } = useTranslation();
  const voiceState = useAtomValue(voiceStateAtom);
  if (!voiceState.roomId) return null;

  const { isMuted, isVideoMuted, connectionQuality, pingMs, roomName, roomId } = voiceState;

  const signalClass =
    connectionQuality < 40
      ? css.signalPoor
      : connectionQuality < 70
        ? css.signalOk
        : css.signalIcon;

  const titlePing =
    pingMs !== null ? t('voice.pingTitle', { ms: pingMs }) : t('voice.voiceConnected');

  return (
    <div className={css.bar}>
      {/* Left — status info, not interactive */}
      <div className={css.status} title={titlePing}>
        <div className={css.connectedRow}>
          <BroadcastIcon size={14} className={signalClass} />
          <span className={css.connected}>{t('voice.connected')}</span>
        </div>
        <span className={css.roomName}>{roomName ?? roomId}</span>
      </div>

      {/* Right — controls */}
      <div className={css.controls}>
        {/* Mute */}
        <button
          className={isMuted ? css.ctrlOff : css.ctrl}
          title={isMuted ? t('voice.unmute') : t('voice.mute')}
          onClick={onToggleMute}
        >
          {isMuted ? <MicrophoneSlashIcon size={16} /> : <MicrophoneIcon size={16} weight="fill" />}
        </button>

        {/* Camera */}
        <button
          className={isVideoMuted ? css.ctrl : css.ctrlActive}
          title={isVideoMuted ? t('voice.cameraOn') : t('voice.cameraOff')}
          onClick={onToggleVideo}
        >
          {isVideoMuted ? (
            <VideoCameraSlashIcon size={16} />
          ) : (
            <VideoCameraIcon size={16} weight="fill" />
          )}
        </button>

        {/* Leave */}
        <button className={css.leaveBtn} title={t('voice.disconnect')} onClick={onLeave}>
          <PhoneDisconnectIcon size={16} />
        </button>
      </div>
    </div>
  );
}
