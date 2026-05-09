import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { themeAtom } from '@/app/store/atoms';
import { THEMES } from '@/theme/themes.css';
import { WelcomePage } from '@/app/pages/auth/WelcomePage';
import { SsoCallback } from '@/app/pages/auth/SsoCallback';
import { ClientLayout } from '@/app/pages/client/ClientLayout';
import { RequireAuth } from '@/app/features/auth/RequireAuth';

export function App() {
  const theme = useAtomValue(themeAtom);

  useEffect(() => {
    const themeClass = THEMES[theme] ?? THEMES['Carbon'];
    Object.values(THEMES).forEach((cls) => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(themeClass);
  }, [theme]);

  return (
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
  );
}
