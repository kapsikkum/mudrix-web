import { useState, useRef, useEffect, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  CellSignalFullIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  PhoneXIcon,
  CaretUpIcon,
} from '@phosphor-icons/react';
import { voiceStateAtom } from '@/app/store/atoms';
import { useAudioDeviceSettings, supportsSinkId } from '@/app/hooks/useAudioDeviceSettings';
import * as css from './VoiceBar.css';

interface Props {
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export function VoiceBar({ onLeave, onToggleMute, onToggleVideo }: Props) {
  const { t } = useTranslation();
  const voiceState = useAtomValue(voiceStateAtom);
  const [showAudioDevices, setShowAudioDevices] = useState(false);
  const [showVideoDevices, setShowVideoDevices] = useState(false);
  const audioDropdownRef = useRef<HTMLDivElement>(null);
  const audioCaretRef = useRef<HTMLButtonElement>(null);
  const videoDropdownRef = useRef<HTMLDivElement>(null);
  const videoCaretRef = useRef<HTMLButtonElement>(null);
  const [audioPos, setAudioPos] = useState<React.CSSProperties>({});
  const [videoPos, setVideoPos] = useState<React.CSSProperties>({});

  const { micId, speakerId, cameraId, devices, setMic, setSpeaker, setCamera, refreshDevices } =
    useAudioDeviceSettings();

  const computePosition = useCallback((el: HTMLElement): React.CSSProperties => {
    const rect = el.getBoundingClientRect();
    const w = 240;
    const gap = 6;
    let left = rect.left;
    if (left + w > window.innerWidth - 8) {
      left = Math.max(8, rect.right - w);
    }
    return {
      position: 'fixed',
      bottom: `${window.innerHeight - rect.top + gap}px`,
      left: `${Math.max(8, left)}px`,
      width: `${w}px`,
      zIndex: 1000,
    };
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      audioDropdownRef.current &&
      !audioDropdownRef.current.contains(e.target as Node) &&
      audioCaretRef.current &&
      !audioCaretRef.current.contains(e.target as Node)
    ) {
      setShowAudioDevices(false);
    }
    if (
      videoDropdownRef.current &&
      !videoDropdownRef.current.contains(e.target as Node) &&
      videoCaretRef.current &&
      !videoCaretRef.current.contains(e.target as Node)
    ) {
      setShowVideoDevices(false);
    }
  }, []);

  useEffect(() => {
    if (showAudioDevices || showVideoDevices) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAudioDevices, showVideoDevices, handleClickOutside]);

  useEffect(() => {
    if (showAudioDevices || showVideoDevices) {
      let cancelled = false;
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
          if (!cancelled) refreshDevices();
        })
        .catch(() => {
          if (!cancelled) refreshDevices();
        });
      return () => {
        cancelled = true;
      };
    }
  }, [showAudioDevices, showVideoDevices, refreshDevices]);

  useEffect(() => {
    if (showAudioDevices && audioCaretRef.current) {
      setAudioPos(computePosition(audioCaretRef.current));
    }
  }, [showAudioDevices, computePosition]);

  useEffect(() => {
    if (showVideoDevices && videoCaretRef.current) {
      setVideoPos(computePosition(videoCaretRef.current));
    }
  }, [showVideoDevices, computePosition]);

  if (!voiceState.roomId) return null;

  const { isMuted, isVideoMuted, connectionQuality, pingMs, roomName, roomId, ready } = voiceState;

  const signalClass =
    connectionQuality < 40
      ? css.signalPoor
      : connectionQuality < 70
        ? css.signalOk
        : css.signalIcon;

  const titlePing =
    pingMs !== null ? t('voice.pingTitle', { ms: pingMs }) : t('voice.voiceConnected');

  const handleMicChange = (deviceId: string) => {
    const label = devices.mics.find((d) => d.deviceId === deviceId)?.label ?? '';
    setMic(deviceId, label);
  };

  const handleSpeakerChange = (deviceId: string) => {
    const label = devices.speakers.find((d) => d.deviceId === deviceId)?.label ?? '';
    setSpeaker(deviceId, label);
  };

  const handleCameraChange = (deviceId: string) => {
    const label = devices.cameras.find((d) => d.deviceId === deviceId)?.label ?? '';
    setCamera(deviceId, label);
  };

  return (
    <div className={css.bar}>
      <div className={css.status} title={ready ? titlePing : t('voice.statusConnecting')}>
        <div className={css.connectedRow}>
          <CellSignalFullIcon size={16} className={ready ? signalClass : css.signalOk} />
          <span className={css.connected}>
            {ready ? t('voice.connected') : t('voice.statusConnecting')}
          </span>
        </div>
        <span className={css.roomName}>{roomName ?? roomId}</span>
      </div>

      <div className={css.controls}>
        {/* Mic — main toggle with caret for audio devices */}
        <div className={css.ctrlSplit}>
          <button
            type="button"
            className={isMuted ? css.ctrlOff : css.ctrl}
            aria-label={isMuted ? t('voice.unmute') : t('voice.mute')}
            onClick={onToggleMute}
          >
            {isMuted ? (
              <MicrophoneSlashIcon size={16} />
            ) : (
              <MicrophoneIcon size={16} weight="fill" />
            )}
          </button>
          <button
            ref={audioCaretRef}
            type="button"
            className={showAudioDevices ? css.ctrlCaretOpen : css.ctrlCaret}
            aria-label={t('voice.quickAudio')}
            onClick={() => setShowAudioDevices((v) => !v)}
          >
            <CaretUpIcon size={8} />
          </button>
        </div>

        {/* Camera — main toggle with caret for camera select */}
        <div className={css.ctrlSplit}>
          <button
            type="button"
            className={isVideoMuted ? css.ctrl : css.ctrlActive}
            aria-label={isVideoMuted ? t('voice.cameraOn') : t('voice.cameraOff')}
            onClick={onToggleVideo}
          >
            {isVideoMuted ? (
              <VideoCameraSlashIcon size={16} />
            ) : (
              <VideoCameraIcon size={16} weight="fill" />
            )}
          </button>
          <button
            ref={videoCaretRef}
            type="button"
            className={showVideoDevices ? css.ctrlCaretOpen : css.ctrlCaret}
            aria-label={t('voice.quickVideo')}
            onClick={() => setShowVideoDevices((v) => !v)}
          >
            <CaretUpIcon size={8} />
          </button>
        </div>

        {/* Leave */}
        <button
          type="button"
          className={css.leaveBtn}
          aria-label={t('voice.disconnect')}
          onClick={onLeave}
        >
          <PhoneXIcon size={16} />
        </button>
      </div>

      {/* Audio devices dropdown — fixed to viewport, escapes sidebar overflow */}
      {showAudioDevices && (
        <div
          ref={audioDropdownRef}
          className={css.deviceDropdown}
          style={audioPos}
          role="dialog"
          aria-label={t('voice.quickSettings')}
        >
          <div className={css.deviceRow}>
            <label className={css.deviceLabel}>{t('settings.audioVideo.microphone')}</label>
            <select
              className={css.deviceSelect}
              value={micId}
              onChange={(e) => handleMicChange(e.target.value)}
            >
              {devices.mics.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label ||
                    t('settings.audioVideo.unknownMicrophone', { id: d.deviceId.slice(0, 6) })}
                </option>
              ))}
            </select>
          </div>
          <div className={css.deviceRow}>
            <label className={css.deviceLabel}>{t('settings.audioVideo.speaker')}</label>
            {supportsSinkId && devices.speakers.length > 0 ? (
              <select
                className={css.deviceSelect}
                value={speakerId}
                onChange={(e) => handleSpeakerChange(e.target.value)}
              >
                {devices.speakers.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label ||
                      t('settings.audioVideo.unknownSpeaker', { id: d.deviceId.slice(0, 6) })}
                  </option>
                ))}
              </select>
            ) : (
              <span className={css.deviceHint}>{t('settings.audioVideo.speakerNotSupported')}</span>
            )}
          </div>
        </div>
      )}

      {/* Camera dropdown — fixed to viewport */}
      {showVideoDevices && (
        <div
          ref={videoDropdownRef}
          className={css.deviceDropdown}
          style={videoPos}
          role="dialog"
          aria-label={t('voice.quickSettings')}
        >
          <div className={css.deviceRow}>
            <label className={css.deviceLabel}>{t('settings.audioVideo.camera')}</label>
            <select
              className={css.deviceSelect}
              value={cameraId}
              onChange={(e) => handleCameraChange(e.target.value)}
            >
              {devices.cameras.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label ||
                    t('settings.audioVideo.unknownCamera', { id: d.deviceId.slice(0, 6) })}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
