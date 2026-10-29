import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { SessionProvider } from '@/app/SessionProvider';
import { prewarmCrypto, cleanupLegacyStorage } from '@/client/initMatrix';
import { registerNotificationServiceWorker } from '@/app/hooks/useNotifications';
import { initDesktop } from '@/util/desktop';

// Reload at most once per 10 s if a lazy-loaded chunk is missing (stale deployment)
window.addEventListener('vite:preloadError', () => {
  try {
    const last = Number(sessionStorage.getItem('chunk_reload_at') ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem('chunk_reload_at', String(Date.now()));
  } catch {
    // Storage unavailable: no guard possible, so skip the reload rather than risk a loop
    return;
  }
  window.location.reload();
});

prewarmCrypto();
void cleanupLegacyStorage();

void registerNotificationServiceWorker();
void initDesktop();

if (window.electronAPI) {
  document.documentElement.classList.add('electron');
  const platform = window.electronAPI.getPlatform?.();
  if (platform) document.documentElement.classList.add(`electron-${platform}`);
  window.electronAPI.onFullscreenChange?.((fullscreen) =>
    document.documentElement.classList.toggle('electron-fullscreen', fullscreen)
  );
}

// Fonts (must be in .tsx, not in .css.ts — VE esbuild can't handle woff2)
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// Theme + global styles (VE side effects)
import '@/theme/reset.css.ts';
import '@/theme/global.css.ts';
import '@/theme/touch.css.ts';

// i18n init (side effect)
import '@/i18n';
import { ROUTER_BASENAME } from '@/util/publicUrl';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
