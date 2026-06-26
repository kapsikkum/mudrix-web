import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { vars } from '@/theme/vars.css';
import * as css from '../Settings.css';
import { useAudioDeviceSettings, supportsSinkId } from '@/app/hooks/useAudioDeviceSettings';

export function AudioVideo() {
  const { t } = useTranslation();
  const {
    micId,
    speakerId,
    cameraId,
    inputVolume,
    outputVolume,
    devices,
    setMic,
    setSpeaker,
    setCamera,
    setInputVolume,
    setOutputVolume,
    refreshDevices,
  } = useAudioDeviceSettings();

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [previewActive, setPreviewActive] = useState(false);

  // Request permissions on mount so device labels become available
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then(() => refreshDevices())
      .catch(() => refreshDevices());

    return () => {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [refreshDevices]);

  const toggleCameraPreview = async () => {
    if (previewActive) {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setPreviewActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraId ? { deviceId: { exact: cameraId } } : true,
        });
        cameraStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPreviewActive(true);
      } catch {
        /* ignore — camera unavailable */
      }
    }
  };

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
    <div>
      <h2 className={css.panelTitle}>{t('settings.audioVideo.title')}</h2>

      {/* Microphone */}
      <div className={css.audioRow}>
        <div className={css.audioDeviceWrap}>
          <label className={`${css.settingLabel} ${css.audioDeviceLabel}`}>
            {t('settings.audioVideo.microphone')}
          </label>
          <select
            className={`${css.select} ${css.audioDeviceSelect}`}
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
        <div className={css.audioVolumeWrap}>
          <label className={css.settingLabel}>{t('settings.audioVideo.inputVolume')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={inputVolume}
            className={css.audioControl}
            onChange={(e) => setInputVolume(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Speaker */}
      <div className={css.audioRow}>
        <div className={css.audioDeviceWrap}>
          <label className={`${css.settingLabel} ${css.audioDeviceLabel}`}>
            {t('settings.audioVideo.speaker')}
          </label>
          {supportsSinkId && devices.speakers.length > 0 ? (
            <select
              className={`${css.select} ${css.audioDeviceSelect}`}
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
            <span className={css.hintText}>{t('settings.audioVideo.speakerNotSupported')}</span>
          )}
        </div>
        <div className={css.audioVolumeWrap}>
          <label className={css.settingLabel}>{t('settings.audioVideo.outputVolume')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={outputVolume}
            className={css.audioControl}
            onChange={(e) => setOutputVolume(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Camera */}
      <div className={css.audioRow}>
        <div className={css.audioDeviceWrap}>
          <label className={`${css.settingLabel} ${css.audioDeviceLabel}`}>
            {t('settings.audioVideo.camera')}
          </label>
          <select
            className={`${css.select} ${css.audioDeviceSelect}`}
            value={cameraId}
            onChange={(e) => handleCameraChange(e.target.value)}
          >
            {devices.cameras.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || t('settings.audioVideo.unknownCamera', { id: d.deviceId.slice(0, 6) })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Camera preview */}
      <div
        onClick={toggleCameraPreview}
        className={css.cameraPreview}
        style={{
          backgroundColor: vars.color.bgTertiary,
          border: previewActive ? 'none' : `2px dashed ${vars.color.border}`,
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={css.cameraPreviewVideo}
          style={{ display: previewActive ? 'block' : 'none' }}
        />
        {!previewActive && (
          <span className={css.cameraPreviewPlaceholder}>
            {t('settings.audioVideo.clickToPreview')}
          </span>
        )}
      </div>
    </div>
  );
}
