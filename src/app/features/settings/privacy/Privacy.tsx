import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  typingIndicatorsAtom,
  sendReadReceiptsAtom,
  showPresenceAtom,
  shareActivityAtom,
  shareActivityGamesAtom,
  shareActivityMusicAtom,
  hiddenActivitiesAtom,
  mediaVisibilityAtom,
  youtubeEmbedsAtom,
  showHomeserverSoftwareAtom,
  type MediaVisibility,
  type YouTubeEmbeds,
} from '@/app/store/atoms';
import { ToggleRow } from '@/app/components/Toggle';
import { Button } from '@/app/components/Button';
import { Select } from '@/app/components/Select';
import { InviteFilter } from '../account';
import { IgnoredUsers } from './IgnoredUsers';
import { useInviteBlocking } from '@/app/hooks/useInviteBlocking';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { isTauriDesktop } from '@/util/desktop';
import { isActivityHidden, useDetectedActivity } from '@/app/hooks/useActivitySharing';
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
        <BlockInvitesToggle />
      </div>

      <div className={css.divider} />

      {isTauriDesktop() && (
        <>
          <ActivitySharing />
          <div className={css.divider} />
        </>
      )}

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

/** Desktop app: show what this computer is playing or listening to. Off until switched on. */
function ActivitySharing() {
  const { t } = useTranslation();
  const [share, setShare] = useAtom(shareActivityAtom);
  const [games, setGames] = useAtom(shareActivityGamesAtom);
  const [music, setMusic] = useAtom(shareActivityMusicAtom);
  const [hidden, setHidden] = useAtom(hiddenActivitiesAtom);
  const detected = useDetectedActivity();
  const shown = share && detected && !isActivityHidden(detected.name, hidden) ? detected : null;

  return (
    <div className={css.section}>
      <h3 className={css.sectionTitle}>{t('settings.privacy.activity.title')}</h3>
      <ToggleRow
        label={t('settings.privacy.activity.share')}
        description={t('settings.privacy.activity.shareNote')}
        checked={share}
        onChange={setShare}
      />
      {share && (
        <>
          <ToggleRow
            label={t('settings.privacy.activity.games')}
            checked={games}
            onChange={setGames}
          />
          <ToggleRow
            label={t('settings.privacy.activity.music')}
            description={t('settings.privacy.activity.musicNote')}
            checked={music}
            onChange={setMusic}
          />
          <div className={css.settingRow}>
            <div className={css.settingInfo}>
              <span className={css.settingLabel}>
                {shown
                  ? t(
                      shown.kind === 'game'
                        ? 'settings.privacy.activity.nowPlaying'
                        : 'settings.privacy.activity.nowListening',
                      { name: shown.details ? `${shown.name} - ${shown.details}` : shown.name }
                    )
                  : t('settings.privacy.activity.nothing')}
              </span>
              <span className={css.settingNote}>{t('settings.privacy.activity.hiddenNote')}</span>
            </div>
            {shown && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setHidden([...hidden, shown.name.trim().toLowerCase()])}
              >
                {t('settings.privacy.activity.hideThis')}
              </Button>
            )}
          </div>
          {hidden.length > 0 && (
            <div className={css.settingRow}>
              <div className={css.settingInfo}>
                <span className={css.settingLabel}>
                  {t('settings.privacy.activity.hiddenCount', { count: hidden.length })}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setHidden([])}>
                {t('settings.privacy.activity.showAgain')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BlockInvitesToggle() {
  const { t } = useTranslation();
  const toast = useToast();
  const { supported, blocked, setBlocked } = useInviteBlocking(getMatrixClientOrNull());
  const [pending, setPending] = useState<boolean | null>(null);

  if (!supported) return null;

  return (
    <ToggleRow
      label={t('settings.privacy.blockInvites')}
      description={t('settings.privacy.blockInvitesNote')}
      checked={pending ?? blocked}
      onChange={async (next) => {
        setPending(next);
        try {
          await setBlocked(next);
        } catch (err) {
          toast.error(t('settings.privacy.blockInvitesFailed', { error: getErrorMessage(err) }));
        } finally {
          setPending(null);
        }
      }}
    />
  );
}
