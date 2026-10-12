export interface ThemeLogoTokens {
  logo: {
    p0: string;
    p1: string;
    p2: string;
    p3: string;
    p4: string;
    p5: string;
    hover: string;
    hoverGlow: string;
  };
}

export interface ThemeColorTokens extends ThemeLogoTokens {
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
    mentionOther: string;
    mentionOtherRgb: string;
    mentionSelf: string;
    mentionSelfRgb: string;
    error: string;
    danger: string;
    success: string;
    warning: string;
    bgAccentGlow1: string;
    bgAccentGlow2: string;
  };
  radius: { sm: string; md: string; lg: string };
  font: { body: string };
}

const BASE_LOGO: ThemeLogoTokens['logo'] = {
  p0: '#6A329F',
  p1: '#784CC8',
  p2: '#6A329F',
  p3: '#784CC8',
  p4: '#5E3079',
  p5: '#885EE7',
  hover: '#9B75F0',
  hoverGlow: '#9B75F099',
};

const HALLOW_LOGO: ThemeLogoTokens['logo'] = {
  p0: '#D95B00',
  p1: '#FF7B00',
  p2: '#D95B00',
  p3: '#FF7B00',
  p4: '#993D00',
  p5: '#FF9D00',
  hover: '#FFB84D',
  hoverGlow: '#FFB84D99',
};

export const THEME_TOKENS: Record<string, ThemeColorTokens> = {
  Carbon: {
    logo: BASE_LOGO,
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
      mentionOther: '#8b9aff',
      mentionOtherRgb: '139, 154, 255',
      mentionSelf: '#f06428',
      mentionSelfRgb: '240, 100, 40',
      error: '#ff6b6b',
      danger: '#b94a48',
      success: '#3ba55d',
      warning: '#ff9d00',
      bgAccentGlow1: 'rgba(88, 101, 242, 0.08)',
      bgAccentGlow2: 'rgba(88, 101, 242, 0.05)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: { body: "'Roboto', sans-serif" },
  },
  Parrot: {
    logo: BASE_LOGO,
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
      mentionOther: '#3fb950',
      mentionOtherRgb: '63, 185, 80',
      mentionSelf: '#f06428',
      mentionSelfRgb: '240, 100, 40',
      error: '#f85149',
      danger: '#f85149',
      success: '#3fb950',
      warning: '#e3a008',
      bgAccentGlow1: 'rgba(63, 185, 80, 0.08)',
      bgAccentGlow2: 'rgba(63, 185, 80, 0.05)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: { body: "'Roboto', sans-serif" },
  },
  Hallow: {
    logo: HALLOW_LOGO,
    color: {
      bgPrimary: '#170f07',
      bgSecondary: '#22160c',
      bgTertiary: '#2e1e11',
      bgInput: '#1f140a',
      bgHover: 'rgba(255, 123, 0, 0.08)',
      bgActive: 'rgba(255, 123, 0, 0.18)',
      accent: '#ff7b00',
      accentRgb: '255, 123, 0',
      accentHover: '#ff9d00',
      textPrimary: '#f2e6da',
      textMuted: '#a88a72',
      textSecondary: '#7d6455',
      border: '#3a2818',
      msgMineBg: '#8f4000',
      msgOtherBg: '#2e1e11',
      mentionOther: '#ffb066',
      mentionOtherRgb: '255, 176, 102',
      mentionSelf: '#f06428',
      mentionSelfRgb: '240, 100, 40',
      error: '#ff6b6b',
      danger: '#c0392b',
      success: '#3ba55d',
      warning: '#ff9d00',
      bgAccentGlow1: 'rgba(255, 123, 0, 0.08)',
      bgAccentGlow2: 'rgba(255, 123, 0, 0.05)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: { body: "'Roboto', sans-serif" },
  },
  Ethereal: {
    logo: BASE_LOGO,
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
      mentionOther: '#6366f1',
      mentionOtherRgb: '99, 102, 241',
      mentionSelf: '#f06428',
      mentionSelfRgb: '240, 100, 40',
      error: '#dc2626',
      danger: '#b91c1c',
      success: '#16a34a',
      warning: '#d97706',
      bgAccentGlow1: 'rgba(99, 102, 241, 0.08)',
      bgAccentGlow2: 'rgba(99, 102, 241, 0.04)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: { body: "'Roboto', sans-serif" },
  },
};
