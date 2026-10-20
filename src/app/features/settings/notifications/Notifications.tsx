import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, XIcon, InfoIcon } from '@phosphor-icons/react';
import type { IPushRules } from 'matrix-js-sdk';
import { useAtom } from 'jotai';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { ToggleRow } from '@/app/components/Toggle';
import { Tooltip } from '@/app/components/Tooltip';
import {
  notificationSoundsAtom,
  notificationBannersAtom,
  notificationSoundPackAtom,
  notificationMentionSoundPackAtom,
  notificationSoundVolumeAtom,
} from '@/app/store/atoms';
import { SOUND_PACKS, previewSoundPack } from '@/util/notificationSounds';
import { requestNotificationPermission } from '@/app/hooks/useNotifications';
import { isTauri } from '@/util/desktop';
import { getErrorMessage } from '@/util/error';
import { Select } from '@/app/components/Select';
import { DesktopPreferences } from './DesktopPreferences';
import * as layoutCss from '../Settings.css';
import * as css from './Notifications.css';
import {
  type ManagedRule,
  type NotifRowLevel,
  DM_RULES,
  ROOM_RULES,
  getUserMentionRules,
  getRoomMentionRules,
  deriveRowLevel,
  setRowLevel,
  listKeywordRules,
  addKeywordRule,
  removeKeywordRule,
  normalizeKeyword,
} from './accountNotifications';

const LEVELS: NotifRowLevel[] = ['off', 'on', 'noisy'];

export function Notifications() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const [notificationSounds, setNotificationSounds] = useAtom(notificationSoundsAtom);
  const [notificationBanners, setNotificationBanners] = useAtom(notificationBannersAtom);
  const [soundPack, setSoundPack] = useAtom(notificationSoundPackAtom);
  const [mentionSoundPack, setMentionSoundPack] = useAtom(notificationMentionSoundPackAtom);
  const [soundVolume, setSoundVolume] = useAtom(notificationSoundVolumeAtom);
  const [rules, setRules] = useState<IPushRules | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState('');

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setRules(await client.getPushRules());
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (!client) return;
      setBusy(true);
      setError(null);
      try {
        await action();
        client.pushRules = await client.getPushRules();
        await load();
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [client, load]
  );

  if (!client) return null;

  const ready = !busy && !!rules;
  const userMentionRules = getUserMentionRules(rules);
  const roomMentionRules = getRoomMentionRules(rules);
  const keywords = listKeywordRules(rules);

  const handleLevel = (managed: ManagedRule[], level: NotifRowLevel) => {
    if (!rules) return;
    void run(() => setRowLevel(client, rules, managed, level));
  };

  const handleAddKeyword = () => {
    if (!ready) return;
    const keyword = normalizeKeyword(keywordInput);
    if (!keyword) return;
    if (keywords.some((r) => r.rule_id === keyword)) {
      setError(t('settings.notifications.keywordExists'));
      return;
    }
    setKeywordInput('');
    void run(() => addKeywordRule(client, keyword));
  };

  const handleRemoveKeyword = (keyword: string) => {
    void run(() => removeKeywordRule(client, keyword));
  };

  const renderLevelRow = (label: string, managed: ManagedRule[]) => {
    const level = deriveRowLevel(rules, managed);
    return (
      <div className={layoutCss.settingRow}>
        <div className={layoutCss.settingInfo}>
          <span className={layoutCss.settingLabel}>{label}</span>
        </div>
        <Select
          aria-label={label}
          value={level}
          disabled={!ready}
          options={LEVELS.map((lv) => ({
            value: lv,
            label: t(`settings.notifications.level.${lv}`),
          }))}
          onChange={(v) => handleLevel(managed, v as NotifRowLevel)}
        />
      </div>
    );
  };

  return (
    <div>
      <h2 className={layoutCss.panelTitle}>{t('settings.notifications.title')}</h2>

      <div className={layoutCss.section}>
        <h3 className={layoutCss.sectionTitle}>{t('settings.notifications.deviceLabel')}</h3>
        <ToggleRow
          label={t('settings.notifications.notificationSounds')}
          description={t('settings.notifications.notificationSoundsNote')}
          checked={notificationSounds}
          onChange={setNotificationSounds}
        />
        {notificationSounds && (
          <>
            <div className={css.soundRow}>
              <span>{t('settings.notifications.soundPack')}</span>
              <div className={css.soundSelect}>
                <Select
                  value={soundPack}
                  aria-label={t('settings.notifications.soundPack')}
                  options={SOUND_PACKS.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={setSoundPack}
                />
              </div>
              <button
                type="button"
                className={css.keywordButton}
                onClick={() => previewSoundPack(soundPack, soundVolume)}
              >
                {t('settings.notifications.soundPreview')}
              </button>
            </div>
            <div className={css.soundRow}>
              <span>{t('settings.notifications.soundVolume')}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={soundVolume}
                className={css.volumeSlider}
                aria-label={t('settings.notifications.soundVolume')}
                onChange={(e) => setSoundVolume(Number(e.target.value))}
              />
              <span>{soundVolume}%</span>
            </div>
            <div className={css.soundRow}>
              <span>{t('settings.notifications.mentionSoundPack')}</span>
              <div className={css.soundSelect}>
                <Select
                  value={mentionSoundPack}
                  aria-label={t('settings.notifications.mentionSoundPackNote')}
                  options={[
                    { value: '', label: t('settings.notifications.mentionSoundSame') },
                    ...SOUND_PACKS.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  onChange={setMentionSoundPack}
                />
              </div>
              <button
                type="button"
                className={css.keywordButton}
                onClick={() =>
                  previewSoundPack(mentionSoundPack || soundPack, soundVolume, 'mention')
                }
              >
                {t('settings.notifications.soundPreview')}
              </button>
            </div>
          </>
        )}
        <ToggleRow
          label={t('settings.notifications.notificationBanners')}
          description={t('settings.notifications.notificationBannersNote')}
          checked={notificationBanners}
          disabled={!isTauri() && !('Notification' in window)}
          onChange={async (v) => {
            if (!v) {
              setNotificationBanners(false);
              return;
            }
            const result = await requestNotificationPermission();
            setNotificationBanners(result === 'granted');
          }}
        />
      </div>

      <div className={layoutCss.divider} />

      <div className={layoutCss.section}>
        <h3 className={layoutCss.sectionTitle}>
          {t('settings.notifications.messagesLabel')}
          <Tooltip content={t('settings.notifications.levelHint')} multiline placement="right">
            <span className={css.levelHint} aria-label={t('settings.notifications.levelHint')}>
              <InfoIcon size={14} />
            </span>
          </Tooltip>
        </h3>
        {renderLevelRow(t('settings.notifications.dms'), DM_RULES)}
        {renderLevelRow(t('settings.notifications.rooms'), ROOM_RULES)}
      </div>

      <div className={layoutCss.divider} />

      <div className={layoutCss.section}>
        <h3 className={layoutCss.sectionTitle}>
          {t('settings.notifications.otherEventsLabel')}
          <Tooltip content={t('settings.notifications.levelHint')} multiline placement="right">
            <span className={css.levelHint} aria-label={t('settings.notifications.levelHint')}>
              <InfoIcon size={14} />
            </span>
          </Tooltip>
        </h3>
        {userMentionRules.length > 0 ? (
          renderLevelRow(t('settings.notifications.userMention'), userMentionRules)
        ) : (
          <p className={layoutCss.settingNote}>{t('settings.notifications.ruleUnavailable')}</p>
        )}
        {roomMentionRules.length > 0 ? (
          renderLevelRow(t('settings.notifications.roomMention'), roomMentionRules)
        ) : (
          <p className={layoutCss.settingNote}>{t('settings.notifications.ruleUnavailable')}</p>
        )}
      </div>

      <div className={layoutCss.divider} />

      <div className={layoutCss.section}>
        <h3 className={layoutCss.sectionTitle}>{t('settings.notifications.keywordsLabel')}</h3>
        <p className={layoutCss.settingNote}>{t('settings.notifications.keywordsNote')}</p>
        <div className={css.keywordRow}>
          <input
            className={`${layoutCss.inputCss} ${css.keywordInput}`}
            value={keywordInput}
            placeholder={t('settings.notifications.keywordPlaceholder')}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddKeyword();
            }}
            disabled={!ready}
          />
          <button
            type="button"
            className={css.keywordButton}
            disabled={!ready}
            onClick={handleAddKeyword}
          >
            <PlusIcon size={14} />
            {t('settings.notifications.addKeyword')}
          </button>
        </div>

        {keywords.length === 0 ? (
          <p className={`${layoutCss.settingNote} ${css.keywordEmpty}`}>
            {t('settings.notifications.noKeywords')}
          </p>
        ) : (
          <ul className={css.keywordList}>
            {keywords.map((rule) => (
              <li key={rule.rule_id} className={css.keywordItem}>
                <span className={css.keywordText}>{rule.rule_id}</span>
                <button
                  type="button"
                  className={css.keywordDel}
                  disabled={busy}
                  onClick={() => handleRemoveKeyword(rule.rule_id)}
                  aria-label={t('common.remove')}
                >
                  <XIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className={css.errorText}>{error}</p>}

      <DesktopPreferences />
    </div>
  );
}
