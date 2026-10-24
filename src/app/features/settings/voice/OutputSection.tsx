import { useTranslation } from 'react-i18next';
import { useAtom, useAtomValue } from 'jotai';
import { PlayIcon } from '@phosphor-icons/react';
import {
  audioOutputDeviceAtom,
  notificationSoundPackAtom,
  notificationSoundVolumeAtom,
} from '@/app/store/atoms';
import { previewSound, setSoundOutputDevice } from '@/util/notificationSounds';
import { supportsOutputSelection, type MediaDevices } from '@/util/mediaDevices';
import * as layoutCss from '../Settings.css';
import * as css from './VoiceAudio.css';
import { DeviceField } from './DeviceField';

export function OutputSection({ media }: { media: MediaDevices }) {
  const { t } = useTranslation();
  const [deviceId, setDeviceId] = useAtom(audioOutputDeviceAtom);
  const soundPack = useAtomValue(notificationSoundPackAtom);
  const soundVolume = useAtomValue(notificationSoundVolumeAtom);

  const handleChange = (id: string) => {
    setDeviceId(id);
    // Apply right away so the test sound already uses it (the app-wide sync runs after render).
    setSoundOutputDevice(id);
  };

  return (
    <div className={layoutCss.section}>
      <h3 className={layoutCss.sectionTitle}>{t('settings.voice.outputTitle')}</h3>
      {supportsOutputSelection() ? (
        <DeviceField
          label={t('settings.voice.speaker')}
          devices={media.audioOutputs}
          value={deviceId}
          onChange={handleChange}
        />
      ) : (
        <p className={layoutCss.settingNote}>{t('settings.voice.outputUnsupported')}</p>
      )}
      <div className={css.buttonRow}>
        <button
          type="button"
          className={css.button}
          onClick={() => previewSound('message', soundPack, soundVolume)}
        >
          <PlayIcon size={16} weight="fill" />
          {t('settings.voice.playTestSound')}
        </button>
      </div>
    </div>
  );
}
