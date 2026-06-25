export interface ThemeColorTokens {
  color: {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgInput: string;
    bgHover: string;
    bgActive: string;
    accent: string;
    accentRgb: string;
    accentHover: string;
    textPrimary: string;
    textMuted: string;
    textSecondary: string;
    border: string;
    msgMineBg: string;
    msgOtherBg: string;
    msgMentionPill: string;
    msgMentionPillRgb: string;
    error: string;
    danger: string;
    success: string;
    bgAccentGlow1: string;
    bgAccentGlow2: string;
  };
  radius: { sm: string; md: string; lg: string };
  font: { body: string };
}

export const THEME_TOKENS: Record<string, ThemeColorTokens> = {
  Carbon: {
    color: {
      bgPrimary: '#11111e',
      bgSecondary: '#1c1c30',
      bgTertiary: '#252540',
      bgInput: '#1a1a2e',
      bgHover: 'rgba(255, 255, 255, 0.05)',
      bgActive: 'rgba(88, 101, 242, 0.2)',
      accent: '#5865f2',
      accentRgb: '88, 101, 242',
      accentHover: '#4752c4',
      textPrimary: '#e8e8f0',
      textMuted: '#8e8ea8',
      textSecondary: '#6d6e82',
      border: '#2e2e50',
      msgMineBg: '#3a3f9e',
      msgOtherBg: '#252540',
      msgMentionPill: '#8b9aff',
      msgMentionPillRgb: '139, 154, 255',
      error: '#ff6b6b',
      danger: '#b94a48',
      success: '#3ba55d',
      bgAccentGlow1: 'rgba(88, 101, 242, 0.08)',
      bgAccentGlow2: 'rgba(88, 101, 242, 0.05)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: { body: "'Roboto', sans-serif" },
  },
  Parrot: {
    color: {
      bgPrimary: '#0d1117',
      bgSecondary: '#161b22',
      bgTertiary: '#21262d',
      bgInput: '#0d1117',
      bgHover: 'rgba(63, 185, 80, 0.08)',
      bgActive: 'rgba(63, 185, 80, 0.18)',
      accent: '#3fb950',
      accentRgb: '63, 185, 80',
      accentHover: '#56d364',
      textPrimary: '#e6edf3',
      textMuted: '#597955',
      textSecondary: '#6e7681',
      border: '#30363d',
      msgMineBg: '#0f2d1a',
      msgOtherBg: '#1c2128',
      msgMentionPill: '#3fb950',
      msgMentionPillRgb: '63, 185, 80',
      error: '#f85149',
      danger: '#f85149',
      success: '#3fb950',
      bgAccentGlow1: 'rgba(63, 185, 80, 0.08)',
      bgAccentGlow2: 'rgba(63, 185, 80, 0.05)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: { body: "'Roboto', sans-serif" },
  },
  Ethereal: {
    color: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f5f3ff',
      bgTertiary: '#ede9fe',
      bgInput: '#ffffff',
      bgHover: 'rgba(99, 102, 241, 0.07)',
      bgActive: 'rgba(99, 102, 241, 0.14)',
      accent: '#6366f1',
      accentRgb: '99, 102, 241',
      accentHover: '#4f46e5',
      textPrimary: '#1a1a2e',
      textMuted: '#6b6b8a',
      textSecondary: '#9292b0',
      border: '#e5e3f0',
      msgMineBg: '#ddd9fb',
      msgOtherBg: '#ede9fe',
      msgMentionPill: '#6366f1',
      msgMentionPillRgb: '99, 102, 241',
      error: '#dc2626',
      danger: '#b91c1c',
      success: '#16a34a',
      bgAccentGlow1: 'rgba(99, 102, 241, 0.08)',
      bgAccentGlow2: 'rgba(99, 102, 241, 0.04)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: { body: "'Roboto', sans-serif" },
  },
};
