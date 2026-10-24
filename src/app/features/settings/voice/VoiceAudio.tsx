import { useTranslation } from 'react-i18next';
import { useMediaDevices } from '@/util/mediaDevices';
import * as layoutCss from '../Settings.css';
import { InputSection } from './InputSection';
import { OutputSection } from './OutputSection';
import { CameraSection } from './CameraSection';
import { SoundsSection } from './SoundsSection';

export function VoiceAudio() {
  const { t } = useTranslation();
  const media = useMediaDevices();

  return (
    <div>
      <h2 className={layoutCss.panelTitle}>{t('settings.voice.title')}</h2>
      <InputSection media={media} />
      <div className={layoutCss.divider} />
      <OutputSection media={media} />
      <div className={layoutCss.divider} />
      <CameraSection media={media} />
      <div className={layoutCss.divider} />
      <SoundsSection />
    </div>
  );
}
