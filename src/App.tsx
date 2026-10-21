import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import {
  effectiveThemeAtom,
  themedAppIconAtom,
  uiZoomAtom,
  messageLayoutAtom,
  messageSendAnimationAtom,
  emojiStyleAtom,
  emojiOnlySizeAtom,
  timeFormatAtom,
  dateFormatAtom,
  hideMembershipEventsAtom,
  hideProfileEventsAtom,
} from '@/app/store/atoms';
import { setDisplayFormats } from '@/util/format';
import { setTimelineDisplayPrefs } from '@/util/timelineDisplay';
import { applyEmojiStyle, applyEmojiOnlySize } from '@/util/emojiStyle';
import { THEMES, DEFAULT_THEME, baseLogoClass } from '@/theme/themes.css';
import { THEME_TOKENS } from '@/theme/themeTokens';
import { WelcomePage } from '@/app/pages/auth/WelcomePage';
import { SsoCallback } from '@/app/pages/auth/SsoCallback';
import { OidcCallback } from '@/app/pages/auth/OidcCallback';
import { ClientLayout } from '@/app/pages/client/ClientLayout';
import { RequireAuth } from '@/app/features/auth/RequireAuth';
import { ErrorBoundary } from '@/app/components/ErrorBoundary/ErrorBoundary';

export function App() {
  const theme = useAtomValue(effectiveThemeAtom);
  const themedAppIcon = useAtomValue(themedAppIconAtom);
  const uiZoom = useAtomValue(uiZoomAtom);
  const messageLayout = useAtomValue(messageLayoutAtom);
  const messageSendAnimation = useAtomValue(messageSendAnimationAtom);
  const timeFormat = useAtomValue(timeFormatAtom);
  const dateFormat = useAtomValue(dateFormatAtom);
  const hideMembershipEvents = useAtomValue(hideMembershipEventsAtom);
  const hideProfileEvents = useAtomValue(hideProfileEventsAtom);
  const emojiStyle = useAtomValue(emojiStyleAtom);
  const emojiOnlySize = useAtomValue(emojiOnlySizeAtom);

  // Synchronous on purpose: descendants format with these during the same render pass.
  setDisplayFormats(timeFormat, dateFormat);
  setTimelineDisplayPrefs({ hideMembershipEvents, hideProfileEvents });

  useEffect(() => {
    const themeClass = THEMES[theme] ?? THEMES[DEFAULT_THEME];
    Object.values(THEMES).forEach((cls) => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(themeClass);
    const { color } = THEME_TOKENS[theme] ?? THEME_TOKENS[DEFAULT_THEME];
    window.electronAPI?.setTitleBarTheme?.(color.bgPrimary, color.textPrimary);
  }, [theme]);

  useEffect(() => {
    const zoom = Number.isFinite(uiZoom) ? Math.min(Math.max(uiZoom, 75), 150) : 100;
    document.documentElement.style.fontSize = zoom === 100 ? '' : `${(16 * zoom) / 100}px`;
  }, [uiZoom]);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-compact-layout', messageLayout === 'compact');
  }, [messageLayout]);

  useEffect(() => {
    applyEmojiStyle(emojiStyle);
  }, [emojiStyle]);

  useEffect(() => {
    applyEmojiOnlySize(emojiOnlySize);
  }, [emojiOnlySize]);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-no-send-anim', !messageSendAnimation);
  }, [messageSendAnimation]);

  useEffect(() => {
    document.documentElement.classList.toggle(baseLogoClass, !themedAppIcon);
  }, [themedAppIcon]);

  return (
    <ErrorBoundary>
      <Routes>
        {/* Public */}
        <Route path="/welcome/:homeserver?" element={<WelcomePage />} />
        <Route path="/sso/callback" element={<SsoCallback />} />
        <Route path="/oidc/callback" element={<OidcCallback />} />

        {/* Protected client routes */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <ClientLayout />
            </RequireAuth>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}
