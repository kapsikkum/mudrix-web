import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { PlayIcon } from '@phosphor-icons/react';
import { ToggleRow } from '@/app/components/Toggle';
import { soundboardEnabledAtom, soundboardVolumeAtom } from '@/app/store/atoms/settings';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId } from '@/util/matrix';
import { useBuiltInSounds } from '@/app/features/soundboard/manifest';
import { useSoundboardMutedUsers } from '@/app/features/soundboard/mute';
import { playClipLocal } from '@/app/features/soundboard/playback';
import * as layoutCss from '../Settings.css';
import * as css from './VoiceAudio.css';

export function SoundboardSection() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useAtom(soundboardEnabledAtom);
  const [volume, setVolume] = useAtom(soundboardVolumeAtom);
  const { mutedUsers, unmute } = useSoundboardMutedUsers();
  const builtIn = useBuiltInSounds();
  const client = getMatrixClientOrNull();
  const sample = builtIn[0];

  const preview = () => {
    if (!sample) return;
    void playClipLocal({
      client,
      senderId: client?.getUserId() ?? '',
      soundId: sample.id,
      name: sample.name,
      emoji: sample.emoji,
      url: sample.url,
      mimetype: sample.mimetype,
      volume: sample.volume,
      durationMs: sample.durationMs,
    });
  };

  return (
    <div className={layoutCss.section}>
      <h3 className={layoutCss.sectionTitle}>{t('settings.voice.soundboardTitle')}</h3>
      <ToggleRow
        label={t('settings.voice.soundboardEnable')}
        description={t('settings.voice.soundboardEnableNote')}
        checked={enabled}
        onChange={setEnabled}
      />
      <div className={css.soundRow}>
        <span className={css.soundLabel}>{t('settings.voice.soundboardVolume')}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          disabled={!enabled}
          className={css.volumeSlider}
          aria-label={t('settings.voice.soundboardVolume')}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
        <span>{volume}%</span>
        {sample && (
          <button
            type="button"
            className={css.iconButton}
            disabled={!enabled}
            aria-label={t('settings.voice.soundboardPreview')}
            onClick={preview}
          >
            <PlayIcon size={16} weight="fill" />
          </button>
        )}
      </div>

      <h4 className={layoutCss.settingLabel}>{t('settings.voice.soundboardMuted')}</h4>
      {mutedUsers.length === 0 ? (
        <p className={layoutCss.settingNote}>{t('settings.voice.soundboardMutedNone')}</p>
      ) : (
        <>
          <p className={layoutCss.settingNote}>{t('settings.voice.soundboardMutedNote')}</p>
          <div>
            {mutedUsers.map((userId) => (
              <div key={userId} className={css.kindRow}>
                <span className={css.kindLabel}>
                  {client?.getUser(userId)?.displayName || formatUserId(userId)}
                </span>
                <button type="button" className={css.button} onClick={() => unmute(userId)}>
                  {t('settings.voice.soundboardUnmute')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
