import { createThemeContract } from '@vanilla-extract/css';

export const vars = createThemeContract({
  color: {
    bgPrimary: null,
    bgSecondary: null,
    bgTertiary: null,
    bgInput: null,
    bgHover: null,
    bgActive: null,
    accent: null,
    accentRgb: null,
    accentHover: null,
    textPrimary: null,
    textMuted: null,
    textSecondary: null,
    border: null,
    msgMineBg: null,
    msgOtherBg: null,
    msgMentionPill: null,
    msgMentionPillRgb: null,
    error: null,
    danger: null,
    success: null,
    bgAccentGlow1: null,
    bgAccentGlow2: null,
  },
  radius: {
    sm: null,
    md: null,
    lg: null,
  },
  font: {
    body: null,
  },
});
