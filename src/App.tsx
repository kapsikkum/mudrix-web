import { useMessageLayout } from '@/app/hooks/useMessageLayout';
import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import {
  effectiveThemeAtom,
  themedAppIconAtom,
  uiZoomAtom,
  messageSendAnimationAtom,
  emojiStyleAtom,
  emojiOnlySizeAtom,
  timeFormatAtom,
  dateFormatAtom,
  hideMembershipEventsAtom,
  hideProfileEventsAtom,
  customThemesAtom,
  useSystemAccentAtom,
} from '@/app/store/atoms';
import { setDisplayFormats } from '@/util/format';
import { setTimelineDisplayPrefs } from '@/util/timelineDisplay';
import { applyEmojiStyle, applyEmojiOnlySize } from '@/util/emojiStyle';
import { THEMES, DEFAULT_THEME, baseLogoClass } from '@/theme/themes.css';
import {
  applyCustomThemeVars,
  isCustomThemeName,
  isLightTheme,
  resolveThemeTokens,
  setCustomThemeRegistry,
} from '@/theme/customThemes';
import { withAccent } from '@/theme/themeTokens';
import { useSystemAccent } from '@/app/hooks/useSystemAccent';
import { WelcomePage } from '@/app/pages/auth/WelcomePage';
import { SsoCallback } from '@/app/pages/auth/SsoCallback';
import { OidcCallback } from '@/app/pages/auth/OidcCallback';
import { ClientLayout } from '@/app/pages/client/ClientLayout';
import { RequireAuth } from '@/app/features/auth/RequireAuth';
import { ErrorBoundary } from '@/app/components/ErrorBoundary/ErrorBoundary';
import { useReducedMotionSync } from '@/app/hooks/useReducedMotion';
import { useChatDisplaySync } from '@/app/hooks/useChatDisplaySync';
import { useUiDensitySync } from '@/app/hooks/useUiDensitySync';
import { useNativeChrome } from '@/app/hooks/useNativeChrome';

export function App() {
  const theme = useAtomValue(effectiveThemeAtom);
  const customThemes = useAtomValue(customThemesAtom);
  const useSystemAccentPref = useAtomValue(useSystemAccentAtom);
  const systemAccent = useSystemAccent(useSystemAccentPref && theme === 'Carbon');
  const themedAppIcon = useAtomValue(themedAppIconAtom);
  const uiZoom = useAtomValue(uiZoomAtom);
  const messageLayout = useMessageLayout();
  const messageSendAnimation = useAtomValue(messageSendAnimationAtom);
  const timeFormat = useAtomValue(timeFormatAtom);
  const dateFormat = useAtomValue(dateFormatAtom);
  const hideMembershipEvents = useAtomValue(hideMembershipEventsAtom);
  const hideProfileEvents = useAtomValue(hideProfileEventsAtom);
  const emojiStyle = useAtomValue(emojiStyleAtom);
  const emojiOnlySize = useAtomValue(emojiOnlySizeAtom);

  // Synchronous on purpose: descendants format with these during the same render pass.
  setDisplayFormats(timeFormat, dateFormat);
  setCustomThemeRegistry(customThemes);
  setTimelineDisplayPrefs({ hideMembershipEvents, hideProfileEvents });
  useReducedMotionSync();
  useChatDisplaySync();
  useUiDensitySync();
  useNativeChrome();

  useEffect(() => {
    // A custom theme sits on top of a built-in light or dark base class.
    const custom = isCustomThemeName(theme);
    const themeClass = custom
      ? THEMES[isLightTheme(theme) ? 'Ethereal' : DEFAULT_THEME]
      : (THEMES[theme] ?? THEMES[DEFAULT_THEME]);
    Object.values(THEMES).forEach((cls) => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(themeClass);
    const base = resolveThemeTokens(theme);
    // Carbon can take the operating system's accent colour (desktop app).
    const accented = theme === 'Carbon' && systemAccent;
    const tokens = accented ? withAccent(base, systemAccent) : base;
    applyCustomThemeVars(custom || accented ? tokens : null);
    if (custom) document.documentElement.setAttribute('data-theme-name', theme);
    else document.documentElement.removeAttribute('data-theme-name');
    window.electronAPI?.setTitleBarTheme?.(tokens.color.bgPrimary, tokens.color.textPrimary);
  }, [theme, customThemes, systemAccent]);

  useEffect(() => {
    const zoom = Number.isFinite(uiZoom) ? Math.min(Math.max(uiZoom, 75), 150) : 100;
    document.documentElement.style.fontSize = zoom === 100 ? '' : `${(16 * zoom) / 100}px`;
  }, [uiZoom]);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-compact-layout', messageLayout === 'compact');
    document.documentElement.toggleAttribute('data-bubble-layout', messageLayout === 'classic');
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
