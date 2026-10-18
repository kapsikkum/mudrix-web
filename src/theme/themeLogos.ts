import { DEFAULT_THEME } from './themes.css';
import { STORAGE_KEY_THEME } from '@/const/storageKeys';
import type { ThemeName } from '@/app/store/atoms/settings';

export interface ThemeLogoAssets {
  logo: string;
  notification: string;
}

const BASE_ASSETS: ThemeLogoAssets = {
  logo: '/assets/images/logo.svg',
  notification: '/assets/images/logo-notification.svg',
};

// Themes without their own artwork fall back to the base logo
export const THEME_LOGO_ASSETS: Record<ThemeName, ThemeLogoAssets> = {
  Carbon: BASE_ASSETS,
  Parrot: {
    logo: '/assets/images/logo_parrot.svg',
    notification: '/assets/images/logo-notification_parrot.svg',
  },
  Hallow: {
    logo: '/assets/images/logo_hallow.svg',
    notification: '/assets/images/logo-notification_hallow.svg',
  },
  Ethereal: BASE_ASSETS,
};

export function getThemeLogoAssets(): ThemeLogoAssets {
  const stored = localStorage.getItem(STORAGE_KEY_THEME);
  const theme = stored && stored in THEME_LOGO_ASSETS ? (stored as ThemeName) : DEFAULT_THEME;
  return THEME_LOGO_ASSETS[theme];
}
