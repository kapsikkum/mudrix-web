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
    mention: string;
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

// p0..p5 are the mud mound facet tones (darkest to lightest), see src/theme/mudMoundGeometry.ts
export const BASE_LOGO: ThemeLogoTokens['logo'] = {
  p0: '#4A301B',
  p1: '#644427',
  p2: '#7A5434',
  p3: '#8A6038',
  p4: '#A87B50',
  p5: '#CFA170',
  hover: '#E2BC8E',
  hoverGlow: '#E2BC8E99',
};

const PARROT_LOGO: ThemeLogoTokens['logo'] = {
  p0: '#1E5128',
  p1: '#34743E',
  p2: '#A8201A',
  p3: '#D7412F',
  p4: '#E0A526',
  p5: '#F5D547',
  hover: '#79C183',
  hoverGlow: '#79C18399',
};

const HALLOW_LOGO: ThemeLogoTokens['logo'] = {
  p0: '#111111',
  p1: '#2B1F3A',
  p2: '#4A2A78',
  p3: '#7A4BC0',
  p4: '#E65F00',
  p5: '#FF9D00',
  hover: '#FFB84D',
  hoverGlow: '#FFB84D99',
};

export const THEME_TOKENS: Record<string, ThemeColorTokens> = {
  Carbon: {
    logo: BASE_LOGO,
    color: {
      bgPrimary: '#1a1b1e',
      bgSecondary: '#131416',
      bgTertiary: '#232428',
      bgInput: '#0e0f11',
      bgHover: 'rgba(255, 255, 255, 0.06)',
      bgActive: 'rgba(88, 101, 242, 0.2)',
      accent: '#5865f2',
      accentRgb: '88, 101, 242',
      accentHover: '#4752c4',
      textPrimary: '#dbdee1',
      textMuted: '#949ba4',
      textSecondary: '#80848e',
      border: '#2b2d31',
      msgMineBg: '#2e3036',
      msgOtherBg: '#131416',
      mention: '#f06428',
      error: '#ff6b6b',
      danger: '#b94a48',
      success: '#3ba55d',
      warning: '#ff9d00',
      bgAccentGlow1: 'rgba(88, 101, 242, 0.05)',
      bgAccentGlow2: 'rgba(88, 101, 242, 0.03)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: {
      body: "var(--mudrix-emoji-font-first, 'Mudrix Twemoji'), 'Roboto', var(--mudrix-emoji-font-last, 'Mudrix Twemoji Full'), sans-serif",
    },
  },
  Parrot: {
    logo: PARROT_LOGO,
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
      textMuted: '#8b949e',
      textSecondary: '#6e7681',
      border: '#30363d',
      msgMineBg: '#0f2d1a',
      msgOtherBg: '#1c2128',
      mention: '#f06428',
      error: '#f85149',
      danger: '#f85149',
      success: '#3fb950',
      warning: '#e3a008',
      bgAccentGlow1: 'rgba(63, 185, 80, 0.08)',
      bgAccentGlow2: 'rgba(63, 185, 80, 0.05)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: {
      body: "var(--mudrix-emoji-font-first, 'Mudrix Twemoji'), 'Roboto', var(--mudrix-emoji-font-last, 'Mudrix Twemoji Full'), sans-serif",
    },
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
      mention: '#f06428',
      error: '#ff6b6b',
      danger: '#c0392b',
      success: '#3ba55d',
      warning: '#ff9d00',
      bgAccentGlow1: 'rgba(255, 123, 0, 0.08)',
      bgAccentGlow2: 'rgba(255, 123, 0, 0.05)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: {
      body: "var(--mudrix-emoji-font-first, 'Mudrix Twemoji'), 'Roboto', var(--mudrix-emoji-font-last, 'Mudrix Twemoji Full'), sans-serif",
    },
  },
  Ethereal: {
    logo: BASE_LOGO,
    color: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f2f3f5',
      bgTertiary: '#e3e5e8',
      bgInput: '#ebedef',
      bgHover: 'rgba(6, 6, 7, 0.05)',
      bgActive: 'rgba(88, 101, 242, 0.14)',
      accent: '#5865f2',
      accentRgb: '88, 101, 242',
      accentHover: '#4752c4',
      textPrimary: '#313338',
      textMuted: '#5c5e66',
      textSecondary: '#747780',
      border: '#d4d7dc',
      msgMineBg: '#dbdee3',
      msgOtherBg: '#f2f3f5',
      mention: '#f06428',
      error: '#dc2626',
      danger: '#b91c1c',
      success: '#16a34a',
      warning: '#d97706',
      bgAccentGlow1: 'rgba(88, 101, 242, 0.05)',
      bgAccentGlow2: 'rgba(88, 101, 242, 0.03)',
    },
    radius: { sm: '4px', md: '8px', lg: '18px' },
    font: {
      body: "var(--mudrix-emoji-font-first, 'Mudrix Twemoji'), 'Roboto', var(--mudrix-emoji-font-last, 'Mudrix Twemoji Full'), sans-serif",
    },
  },
};
