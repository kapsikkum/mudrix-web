import {
  PhoneIcon,
  MicrophoneSlashIcon,
  MicrophoneIcon,
  PhoneDisconnectIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { CallState } from '@/app/store/atoms/call';
import * as css from './InCallControls.css';

interface Props {
  callState: CallState;
  onToggleMute: () => void;
  onHangup: () => void;
}

export function InCallControls({ callState, onToggleMute, onHangup }: Props) {
  const { t } = useTranslation();

  const isOutgoingPending = !callState.incoming && callState.callerId !== null && !callState.active;
  if (callState.incoming || (!callState.active && !isOutgoingPending)) return null;

  const displayName = callState.callerName ?? t('voice.call');
  const MicIcon = callState.isMuted ? MicrophoneSlashIcon : MicrophoneIcon;
  const muteTitle = callState.isMuted ? t('voice.unmute') : t('voice.mute');

  return (
    <div className={css.bar}>
      {/* Green pulse indicator */}
      <div className={css.callIndicator}>
        <div className={css.pulse} />
        <PhoneIcon size={14} />
      </div>

      {/* Caller info */}
      <div className={css.info}>
        <div className={css.callerName}>{displayName}</div>
        <div className={css.callStatus}>{callState.status || t('voice.connected')}</div>
      </div>

      {/* Controls */}
      <div className={css.controls}>
        <button
          type="button"
          className={callState.isMuted ? css.muteBtnActive : css.muteBtn}
          title={muteTitle}
          onClick={onToggleMute}
          aria-label={muteTitle}
        >
          <MicIcon size={15} />
        </button>

        <button
          type="button"
          className={css.hangupBtn}
          title={t('voice.hangup')}
          onClick={onHangup}
          aria-label={t('voice.hangup')}
        >
          <PhoneDisconnectIcon size={15} />
        </button>
      </div>
    </div>
  );
}
