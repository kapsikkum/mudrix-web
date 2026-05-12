import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { vars } from '@/theme/vars.css';
import * as css from '../Settings.css';

export function AudioVideo() {
  const { t } = useTranslation();
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState(localStorage.getItem('selectedMicId') ?? '');
  const [selectedSpeaker, setSelectedSpeaker] = useState(
    localStorage.getItem('selectedSpeakerId') ?? ''
  );
  const [selectedCamera, setSelectedCamera] = useState(
    localStorage.getItem('selectedCameraId') ?? ''
  );
  const [inputVol, setInputVol] = useState(Number(localStorage.getItem('inputVolume') ?? 1));
  const [outputVol, setOutputVol] = useState(Number(localStorage.getItem('outputVolume') ?? 1));
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then(() => navigator.mediaDevices.enumerateDevices())
      .then((devices) => {
        setMics(devices.filter((d) => d.kind === 'audioinput'));
        setSpeakers(devices.filter((d) => d.kind === 'audiooutput'));
        setCameras(devices.filter((d) => d.kind === 'videoinput'));
      })
      .catch(() => {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
          setMics(devices.filter((d) => d.kind === 'audioinput'));
          setSpeakers(devices.filter((d) => d.kind === 'audiooutput'));
          setCameras(devices.filter((d) => d.kind === 'videoinput'));
        });
      });
    return () => {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const [previewActive, setPreviewActive] = useState(false);

  const toggleCameraPreview = async () => {
    if (previewActive) {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setPreviewActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        });
        cameraStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPreviewActive(true);
      } catch {
        /* ignore — camera unavailable */
      }
    }
  };

  const persist = (key: string, value: string) => localStorage.setItem(key, value);

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.audioVideo.title')}</h2>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.audioVideo.input')}</h3>
        <div
          className={css.settingRow}
          style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}
        >
          <label className={css.settingLabel}>{t('settings.audioVideo.microphone')}</label>
          <select
            className={css.inputFull}
            value={selectedMic}
            onChange={(e) => {
              setSelectedMic(e.target.value);
              persist('selectedMicId', e.target.value);
            }}
          >
            {mics.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label ||
                  t('settings.audioVideo.unknownMicrophone', { id: d.deviceId.slice(0, 6) })}
              </option>
            ))}
          </select>
        </div>
        <div
          className={css.settingRow}
          style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}
        >
          <label className={css.settingLabel}>{t('settings.audioVideo.volume')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={inputVol}
            className={css.inputFull}
            onChange={(e) => {
              const v = Number(e.target.value);
              setInputVol(v);
              persist('inputVolume', String(v));
            }}
          />
        </div>
      </div>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.audioVideo.output')}</h3>
        <div
          className={css.settingRow}
          style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}
        >
          <label className={css.settingLabel}>{t('settings.audioVideo.speaker')}</label>
          <select
            className={css.inputFull}
            value={selectedSpeaker}
            onChange={(e) => {
              setSelectedSpeaker(e.target.value);
              persist('selectedSpeakerId', e.target.value);
            }}
          >
            {speakers.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || t('settings.audioVideo.unknownSpeaker', { id: d.deviceId.slice(0, 6) })}
              </option>
            ))}
          </select>
        </div>
        <div
          className={css.settingRow}
          style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}
        >
          <label className={css.settingLabel}>{t('settings.audioVideo.volume')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={outputVol}
            className={css.inputFull}
            onChange={(e) => {
              const v = Number(e.target.value);
              setOutputVol(v);
              persist('outputVolume', String(v));
            }}
          />
        </div>
      </div>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.audioVideo.camera')}</h3>
        <div
          className={css.settingRow}
          style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}
        >
          <label className={css.settingLabel}>{t('settings.audioVideo.camera')}</label>
          <select
            className={css.inputFull}
            value={selectedCamera}
            onChange={(e) => {
              setSelectedCamera(e.target.value);
              persist('selectedCameraId', e.target.value);
            }}
          >
            {cameras.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || t('settings.audioVideo.unknownCamera', { id: d.deviceId.slice(0, 6) })}
              </option>
            ))}
          </select>
        </div>
        {/* Clickable preview square */}
        <div
          onClick={toggleCameraPreview}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '320px',
            aspectRatio: '16 / 9',
            borderRadius: '8px',
            overflow: 'hidden',
            cursor: 'pointer',
            backgroundColor: vars.color.bgTertiary,
            border: previewActive ? 'none' : `2px dashed ${vars.color.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '8px',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: previewActive ? 'block' : 'none',
            }}
          />
          {!previewActive && (
            <span
              style={{
                fontSize: '0.82rem',
                color: vars.color.textMuted,
                textAlign: 'center',
                padding: '0 16px',
                userSelect: 'none',
              }}
            >
              {t('settings.audioVideo.clickToPreview')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
