import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  themeAtom,
  effectiveThemeAtom,
  messageLayoutAtom,
  prettifyLinksAtom,
  showRoomAvatarsAtom,
  themedAppIconAtom,
  followSystemThemeAtom,
  systemDarkThemeAtom,
  systemLightThemeAtom,
  uiZoomAtom,
  compactMessagesAtom,
  profileEffectsAtom,
  type ThemeName,
  type MessageLayout,
} from '@/app/store/atoms';
import { THEME_TOKENS } from '@/theme/themeTokens';
import { hasThemedLogo } from '@/theme/themeLogos';
import { useMemo } from 'react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar } from '@/app/components/Avatar';
import { Select } from '@/app/components/Select';
import { ToggleRow } from '@/app/components/Toggle';
import { Tooltip } from '@/app/components/Tooltip';
import { plainTextToHtml } from '@/util/markdownToHtml';
import { formatTime } from '@/util/format';
import * as timelineCss from '@/app/features/timeline/Timeline.css';
import { EmojiStyleSection } from '../emojis/EmojiStyleSection';
import * as css from './Appearance.css';
import * as layoutCss from '../Settings.css';

const THEME_NAMES: ThemeName[] = ['Carbon', 'Parrot', 'Hallow', 'Ethereal'];
const THEME_OPTIONS = THEME_NAMES.map((name) => ({ value: name, label: name }));
const ZOOM_LEVELS = [75, 90, 100, 110, 125, 150];
const ZOOM_OPTIONS = ZOOM_LEVELS.map((level) => ({ value: String(level), label: `${level}%` }));

const PREVIEW_OTHER_NAME = 'Merlin';

interface PreviewMessageProps {
  layout: MessageLayout;
  isOwn: boolean;
  senderName: string;
  senderAvatar?: string | null;
  html: string;
  time: string;
}

function PreviewMessage({
  layout,
  isOwn,
  senderName,
  senderAvatar,
  html,
  time,
}: PreviewMessageProps) {
  const client = getMatrixClientOrNull();
  const contentClass =
    layout === 'classic'
      ? isOwn
        ? timelineCss.msgContentClassicOwn
        : timelineCss.msgContentClassic
      : timelineCss.msgContent;

  return (
    <div className={timelineCss.msgRow}>
      <div className={timelineCss.msgHoverRegion}>
        <div className={timelineCss.msgAvatarCol}>
          <Avatar
            name={senderName}
            mxcUrl={senderAvatar}
            client={client}
            size="sm"
            placeholder="logo"
          />
        </div>
        <div className={timelineCss.msgBody}>
          <div className={timelineCss.msgMeta}>
            <span className={css.previewSender}>{senderName}</span>
            <span className={timelineCss.msgTime}>{time}</span>
          </div>
          <div className={contentClass}>
            <span dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatPreview({ layout, prettifyLinks }: { layout: MessageLayout; prettifyLinks: boolean }) {
  const { t, i18n } = useTranslation();
  const client = getMatrixClientOrNull();
  const myId = client?.getUserId() ?? undefined;
  const me = myId ? client?.getUser(myId) : null;
  const myName = me?.displayName || myId || '';

  const otherHtml = useMemo(
    () => plainTextToHtml(t('settings.appearance.previewOtherMessage'), myId, true, prettifyLinks),
    [t, myId, prettifyLinks]
  );
  const ownHtml = useMemo(
    () => plainTextToHtml(t('settings.appearance.previewOwnMessage'), myId, true, prettifyLinks),
    [t, myId, prettifyLinks]
  );

  const time = (offsetMin: number) => formatTime(Date.now() - offsetMin * 60_000, i18n.language);

  return (
    <div className={css.preview} aria-hidden="true" onClickCapture={(e) => e.preventDefault()}>
      <PreviewMessage
        layout={layout}
        isOwn={false}
        senderName={PREVIEW_OTHER_NAME}
        html={otherHtml}
        time={time(2)}
      />
      <PreviewMessage
        layout={layout}
        isOwn
        senderName={myName}
        senderAvatar={me?.avatarUrl}
        html={ownHtml}
        time={time(1)}
      />
    </div>
  );
}

export function Appearance() {
  const { t } = useTranslation();
  const [theme, setTheme] = useAtom(themeAtom);
  const [layout, setLayout] = useAtom(messageLayoutAtom);
  const [prettifyLinks, setPrettifyLinks] = useAtom(prettifyLinksAtom);
  const [showRoomAvatars, setShowRoomAvatars] = useAtom(showRoomAvatarsAtom);
  const [themedAppIcon, setThemedAppIcon] = useAtom(themedAppIconAtom);
  const [followSystem, setFollowSystem] = useAtom(followSystemThemeAtom);
  const [darkTheme, setDarkTheme] = useAtom(systemDarkThemeAtom);
  const [lightTheme, setLightTheme] = useAtom(systemLightThemeAtom);
  const [uiZoom, setUiZoom] = useAtom(uiZoomAtom);
  const [compactMessages, setCompactMessages] = useAtom(compactMessagesAtom);
  const [profileEffects, setProfileEffects] = useAtom(profileEffectsAtom);
  const effectiveTheme = useAtomValue(effectiveThemeAtom);
  const themeHasIcon = hasThemedLogo(effectiveTheme);

  return (
    <div>
      <h2 className={layoutCss.panelTitle}>{t('settings.appearance.title')}</h2>

      <div className={layoutCss.section}>
        <ChatPreview layout={layout} prettifyLinks={prettifyLinks} />

        <ToggleRow
          label={t('settings.appearance.followSystemTheme')}
          description={t('settings.appearance.followSystemThemeNote')}
          checked={followSystem}
          onChange={setFollowSystem}
        />

        {followSystem ? (
          <>
            <div className={layoutCss.settingRow}>
              <div className={layoutCss.settingInfo}>
                <span className={layoutCss.settingLabel}>
                  {t('settings.appearance.systemDarkTheme')}
                </span>
              </div>
              <Select<ThemeName>
                aria-label={t('settings.appearance.systemDarkTheme')}
                value={darkTheme}
                options={THEME_OPTIONS}
                onChange={setDarkTheme}
              />
            </div>
            <div className={layoutCss.settingRow}>
              <div className={layoutCss.settingInfo}>
                <span className={layoutCss.settingLabel}>
                  {t('settings.appearance.systemLightTheme')}
                </span>
              </div>
              <Select<ThemeName>
                aria-label={t('settings.appearance.systemLightTheme')}
                value={lightTheme}
                options={THEME_OPTIONS}
                onChange={setLightTheme}
              />
            </div>
          </>
        ) : (
          <div className={layoutCss.settingRow}>
            <div className={layoutCss.settingInfo}>
              <span className={layoutCss.settingLabel}>{t('settings.appearance.theme')}</span>
            </div>
            <div
              className={css.swatchRow}
              role="radiogroup"
              aria-label={t('settings.appearance.theme')}
            >
              {THEME_NAMES.map((name) => {
                const { color } = THEME_TOKENS[name];
                const isActive = theme === name;
                return (
                  <Tooltip key={name} content={name}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={name}
                      onClick={() => setTheme(name)}
                      className={isActive ? css.swatchActive : css.swatch}
                      style={{
                        background: `linear-gradient(135deg, ${color.bgSecondary} 50%, ${color.accent} 50%)`,
                      }}
                    />
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}

        <div className={layoutCss.settingRow}>
          <div className={layoutCss.settingInfo}>
            <span className={layoutCss.settingLabel}>{t('settings.appearance.uiZoom')}</span>
            <span className={layoutCss.settingNote}>{t('settings.appearance.uiZoomNote')}</span>
          </div>
          <Select
            aria-label={t('settings.appearance.uiZoom')}
            value={String(uiZoom)}
            options={
              ZOOM_LEVELS.includes(uiZoom)
                ? ZOOM_OPTIONS
                : [...ZOOM_OPTIONS, { value: String(uiZoom), label: `${uiZoom}%` }]
            }
            onChange={(v) => setUiZoom(Number(v))}
          />
        </div>

        <div className={layoutCss.settingRow}>
          <div className={layoutCss.settingInfo}>
            <span className={layoutCss.settingLabel}>{t('settings.appearance.messageLayout')}</span>
          </div>
          <Select<MessageLayout>
            aria-label={t('settings.appearance.messageLayout')}
            value={layout}
            options={[
              { value: 'modern', label: t('settings.appearance.modern') },
              { value: 'classic', label: t('settings.appearance.classic') },
            ]}
            onChange={setLayout}
          />
        </div>

        <ToggleRow
          label={t('settings.appearance.compactMessages')}
          description={t('settings.appearance.compactMessagesNote')}
          checked={compactMessages}
          onChange={setCompactMessages}
        />
        <ToggleRow
          label={t('settings.appearance.profileEffects')}
          description={t('settings.appearance.profileEffectsNote')}
          checked={profileEffects}
          onChange={setProfileEffects}
        />
        <ToggleRow
          label={t('settings.preferences.prettifyLinks')}
          description={t('settings.preferences.prettifyLinksNote')}
          checked={prettifyLinks}
          onChange={setPrettifyLinks}
        />
        <ToggleRow
          label={t('settings.appearance.themedAppIcon')}
          checked={themeHasIcon && themedAppIcon}
          disabled={!themeHasIcon}
          onChange={setThemedAppIcon}
        />
      </div>

      <div className={layoutCss.divider} />

      <div className={layoutCss.section}>
        <ToggleRow
          label={t('settings.preferences.showRoomAvatars')}
          checked={showRoomAvatars}
          onChange={setShowRoomAvatars}
        />
      </div>

      <div className={layoutCss.divider} />

      <EmojiStyleSection />
    </div>
  );
}
