import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  typingIndicatorsAtom,
  sendReadReceiptsAtom,
  showPresenceAtom,
  mediaVisibilityAtom,
  youtubeEmbedsAtom,
  showHomeserverSoftwareAtom,
  type MediaVisibility,
  type YouTubeEmbeds,
} from '@/app/store/atoms';
import { ToggleRow } from '@/app/components/Toggle';
import { Select } from '@/app/components/Select';
import { InviteFilter } from '../account';
import { IgnoredUsers } from './IgnoredUsers';
import * as css from '../Settings.css';

const MEDIA_VISIBILITY_OPTIONS: Record<MediaVisibility, string> = {
  always: 'settings.privacy.mediaVisibilityAlways',
  private: 'settings.privacy.mediaVisibilityPrivate',
  never: 'settings.privacy.mediaVisibilityNever',
};

const YOUTUBE_EMBED_OPTIONS: Record<YouTubeEmbeds, string> = {
  ask: 'settings.privacy.youtubeEmbedsAsk',
  on: 'settings.privacy.youtubeEmbedsOn',
  off: 'settings.privacy.youtubeEmbedsOff',
};

export function Privacy() {
  const { t } = useTranslation();
  const [typingIndicators, setTypingIndicators] = useAtom(typingIndicatorsAtom);
  const [sendReadReceipts, setSendReadReceipts] = useAtom(sendReadReceiptsAtom);
  const [showPresence, setShowPresence] = useAtom(showPresenceAtom);
  const [mediaVisibility, setMediaVisibility] = useAtom(mediaVisibilityAtom);
  const [youtubeEmbeds, setYoutubeEmbeds] = useAtom(youtubeEmbedsAtom);
  const [showHomeserverSoftware, setShowHomeserverSoftware] = useAtom(showHomeserverSoftwareAtom);

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.privacy.title')}</h2>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.privacy.chat')}</h3>

        <ToggleRow
          label={t('settings.privacy.typingIndicators')}
          description={t('settings.privacy.typingIndicatorsNote')}
          checked={typingIndicators}
          onChange={setTypingIndicators}
        />
        <ToggleRow
          label={t('settings.privacy.sendReadReceipts')}
          description={t('settings.privacy.sendReadReceiptsNote')}
          checked={sendReadReceipts}
          onChange={setSendReadReceipts}
        />
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.privacy.media')}</h3>

        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.privacy.mediaVisibility')}</span>
          </div>
          <Select
            aria-label={t('settings.privacy.mediaVisibility')}
            value={mediaVisibility}
            options={Object.entries(MEDIA_VISIBILITY_OPTIONS).map(([option, labelKey]) => ({
              value: option,
              label: t(labelKey),
            }))}
            onChange={(v) => setMediaVisibility(v as MediaVisibility)}
          />
        </div>

        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.privacy.youtubeEmbeds')}</span>
            <span className={css.settingNote}>{t('settings.privacy.youtubeEmbedsNote')}</span>
          </div>
          <Select
            aria-label={t('settings.privacy.youtubeEmbeds')}
            value={youtubeEmbeds}
            options={Object.entries(YOUTUBE_EMBED_OPTIONS).map(([option, labelKey]) => ({
              value: option,
              label: t(labelKey),
            }))}
            onChange={(v) => setYoutubeEmbeds(v as YouTubeEmbeds)}
          />
        </div>
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.privacy.other')}</h3>

        <ToggleRow
          label={t('settings.privacy.showPresence')}
          description={t('settings.privacy.showPresenceNote')}
          checked={showPresence}
          onChange={setShowPresence}
        />
        <ToggleRow
          label={t('settings.privacy.showHomeserverSoftware')}
          description={t('settings.privacy.showHomeserverSoftwareNote')}
          checked={showHomeserverSoftware}
          onChange={setShowHomeserverSoftware}
        />
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.privacy.ignoredUsers')}</h3>
        <IgnoredUsers />
      </div>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.account.invitesTitle')}</h3>
        <InviteFilter />
      </div>
    </div>
  );
}
