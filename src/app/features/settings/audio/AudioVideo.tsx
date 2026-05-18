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

      <div className={css.audioRow}>
        <div className={css.audioDeviceWrap}>
          <label className={`${css.settingLabel} ${css.audioDeviceLabel}`}>{t('settings.audioVideo.microphone')}</label>
          <select
            className={`${css.select} ${css.audioDeviceSelect}`}
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
        <div className={css.audioVolumeWrap}>
          <label className={css.settingLabel}>{t('settings.audioVideo.volume')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={inputVol}
            className={css.audioControl}
            onChange={(e) => {
              const v = Number(e.target.value);
              setInputVol(v);
              persist('inputVolume', String(v));
            }}
          />
        </div>
      </div>

      <div className={css.audioRow}>
        <div className={css.audioDeviceWrap}>
          <label className={`${css.settingLabel} ${css.audioDeviceLabel}`}>{t('settings.audioVideo.speaker')}</label>
          <select
            className={`${css.select} ${css.audioDeviceSelect}`}
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
        <div className={css.audioVolumeWrap}>
          <label className={css.settingLabel}>{t('settings.audioVideo.volume')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={outputVol}
            className={css.audioControl}
            onChange={(e) => {
              const v = Number(e.target.value);
              setOutputVol(v);
              persist('outputVolume', String(v));
            }}
          />
        </div>
      </div>

      <div className={css.audioRow}>
        <div className={css.audioDeviceWrap}>
          <label className={`${css.settingLabel} ${css.audioDeviceLabel}`}>{t('settings.audioVideo.camera')}</label>
          <select
            className={`${css.select} ${css.audioDeviceSelect}`}
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
      </div>

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
