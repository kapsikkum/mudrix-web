import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { themeAtom, themedAppIconAtom } from '@/app/store/atoms';
import { THEMES, DEFAULT_THEME, baseLogoClass } from '@/theme/themes.css';
import { THEME_TOKENS } from '@/theme/themeTokens';
import { WelcomePage } from '@/app/pages/auth/WelcomePage';
import { SsoCallback } from '@/app/pages/auth/SsoCallback';
import { OidcCallback } from '@/app/pages/auth/OidcCallback';
import { ClientLayout } from '@/app/pages/client/ClientLayout';
import { RequireAuth } from '@/app/features/auth/RequireAuth';
import { ErrorBoundary } from '@/app/components/ErrorBoundary/ErrorBoundary';

export function App() {
  const theme = useAtomValue(themeAtom);
  const themedAppIcon = useAtomValue(themedAppIconAtom);

  useEffect(() => {
    const themeClass = THEMES[theme] ?? THEMES[DEFAULT_THEME];
    Object.values(THEMES).forEach((cls) => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(themeClass);
    const { color } = THEME_TOKENS[theme] ?? THEME_TOKENS[DEFAULT_THEME];
    window.electronAPI?.setTitleBarTheme?.(color.bgPrimary, color.textPrimary);
  }, [theme]);

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
