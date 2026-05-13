import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { themeAtom } from '@/app/store/atoms';
import { THEMES, DEFAULT_THEME } from '@/theme/themes.css';
import { WelcomePage } from '@/app/pages/auth/WelcomePage';
import { SsoCallback } from '@/app/pages/auth/SsoCallback';
import { ClientLayout } from '@/app/pages/client/ClientLayout';
import { RequireAuth } from '@/app/features/auth/RequireAuth';
import { ErrorBoundary } from '@/app/components/ErrorBoundary/ErrorBoundary';

export function App() {
  const theme = useAtomValue(themeAtom);

  useEffect(() => {
    const themeClass = THEMES[theme] ?? THEMES[DEFAULT_THEME];
    Object.values(THEMES).forEach((cls) => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(themeClass);
  }, [theme]);

  return (
    <ErrorBoundary>
      <Routes>
        {/* Public */}
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/sso/callback" element={<SsoCallback />} />

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
