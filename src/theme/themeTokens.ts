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

// --- Theme builder -------------------------------------------------------------------------------
// Built-in extra themes and user-made custom themes are described by a handful of colours; the
// rest of the tokens (hover/active tints, input background, glows, status colours) are derived.

export interface ThemeSpec {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  accent: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  msgMineBg: string;
  msgOtherBg: string;
}

export const THEME_SPEC_KEYS: readonly (keyof ThemeSpec)[] = [
  'bgPrimary',
  'bgSecondary',
  'bgTertiary',
  'accent',
  'textPrimary',
  'textMuted',
  'border',
  'msgMineBg',
  'msgOtherBg',
];

const HEX6 = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX6.test(value);
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const channel = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`;
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** True for a light background (relative luminance above the midpoint). */
export function isLightColor(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}

export function buildThemeTokens(spec: ThemeSpec): ThemeColorTokens {
  const light = isLightColor(spec.bgPrimary);
  const accentRgb = hexToRgb(spec.accent).join(', ');
  return {
    logo: BASE_LOGO,
    color: {
      bgPrimary: spec.bgPrimary,
      bgSecondary: spec.bgSecondary,
      bgTertiary: spec.bgTertiary,
      bgInput: mixHex(spec.bgSecondary, '#000000', light ? 0.04 : 0.35),
      bgHover: light ? 'rgba(6, 6, 7, 0.05)' : 'rgba(255, 255, 255, 0.06)',
      bgActive: rgba(spec.accent, light ? 0.14 : 0.2),
      accent: spec.accent,
      accentRgb,
      accentHover: mixHex(spec.accent, '#000000', 0.18),
      textPrimary: spec.textPrimary,
      textMuted: spec.textMuted,
      textSecondary: mixHex(spec.textMuted, spec.bgPrimary, 0.35),
      border: spec.border,
      msgMineBg: spec.msgMineBg,
      msgOtherBg: spec.msgOtherBg,
      mention: '#f06428',
      error: light ? '#dc2626' : '#ff6b6b',
      danger: light ? '#b91c1c' : '#b94a48',
      success: light ? '#16a34a' : '#3ba55d',
      warning: light ? '#d97706' : '#ff9d00',
      bgAccentGlow1: rgba(spec.accent, 0.05),
      bgAccentGlow2: rgba(spec.accent, 0.03),
    },
    radius: THEME_TOKENS.Carbon.radius,
    font: THEME_TOKENS.Carbon.font,
  };
}

/** The colours of a theme in editable form (used to start a custom theme from it). */
export function specFromTokens(tokens: ThemeColorTokens): ThemeSpec {
  const c = tokens.color;
  const hex = (value: string, fallback: string) => (isHexColor(value) ? value : fallback);
  return {
    bgPrimary: hex(c.bgPrimary, '#1a1b1e'),
    bgSecondary: hex(c.bgSecondary, '#131416'),
    bgTertiary: hex(c.bgTertiary, '#232428'),
    accent: hex(c.accent, '#5865f2'),
    textPrimary: hex(c.textPrimary, '#dbdee1'),
    textMuted: hex(c.textMuted, '#949ba4'),
    border: hex(c.border, '#2b2d31'),
    msgMineBg: hex(c.msgMineBg, '#2e3036'),
    msgOtherBg: hex(c.msgOtherBg, '#131416'),
  };
}

const EXTRA_THEME_SPECS: Record<string, ThemeSpec> = {
  Midnight: {
    bgPrimary: '#0b1020',
    bgSecondary: '#080c18',
    bgTertiary: '#141b30',
    accent: '#4d8dff',
    textPrimary: '#d7e0f5',
    textMuted: '#8a97b8',
    border: '#1b2440',
    msgMineBg: '#1a2c55',
    msgOtherBg: '#0f1528',
  },
  Nord: {
    bgPrimary: '#2e3440',
    bgSecondary: '#272c36',
    bgTertiary: '#3b4252',
    accent: '#88c0d0',
    textPrimary: '#eceff4',
    textMuted: '#a3adbf',
    border: '#434c5e',
    msgMineBg: '#3b4a5e',
    msgOtherBg: '#2b303b',
  },
  Dracula: {
    bgPrimary: '#282a36',
    bgSecondary: '#21222c',
    bgTertiary: '#343746',
    accent: '#bd93f9',
    textPrimary: '#f8f8f2',
    textMuted: '#a9afd1',
    border: '#3a3d4e',
    msgMineBg: '#44436a',
    msgOtherBg: '#232531',
  },
  Rose: {
    bgPrimary: '#191724',
    bgSecondary: '#14121f',
    bgTertiary: '#26233a',
    accent: '#eb6f92',
    textPrimary: '#e0def4',
    textMuted: '#908caa',
    border: '#2a273f',
    msgMineBg: '#3b2a42',
    msgOtherBg: '#1f1d2e',
  },
  Mocha: {
    bgPrimary: '#1e1e2e',
    bgSecondary: '#181825',
    bgTertiary: '#313244',
    accent: '#cba6f7',
    textPrimary: '#cdd6f4',
    textMuted: '#a6adc8',
    border: '#313244',
    msgMineBg: '#3b3a55',
    msgOtherBg: '#181825',
  },
  Daybreak: {
    bgPrimary: '#fbf7f0',
    bgSecondary: '#f1ebe0',
    bgTertiary: '#e6dfd1',
    accent: '#d9730d',
    textPrimary: '#3a3226',
    textMuted: '#6f6657',
    border: '#d8cfbe',
    msgMineBg: '#f0dcc0',
    msgOtherBg: '#f1ebe0',
  },
  Sakura: {
    bgPrimary: '#fff8fa',
    bgSecondary: '#fdeef3',
    bgTertiary: '#f6dbe5',
    accent: '#e0508a',
    textPrimary: '#4a2f3b',
    textMuted: '#85606f',
    border: '#f0cbd9',
    msgMineBg: '#f9d3e2',
    msgOtherBg: '#fdeef3',
  },
  OLED: {
    bgPrimary: '#000000',
    bgSecondary: '#050505',
    bgTertiary: '#121212',
    accent: '#6d7cff',
    textPrimary: '#e6e6e6',
    textMuted: '#8a8a8a',
    border: '#1a1a1a',
    msgMineBg: '#181a26',
    msgOtherBg: '#0b0b0b',
  },
  Crimson: {
    bgPrimary: '#1a0d10',
    bgSecondary: '#130a0c',
    bgTertiary: '#2a1419',
    accent: '#e53950',
    textPrimary: '#f3e3e5',
    textMuted: '#b08d93',
    border: '#3a1c23',
    msgMineBg: '#4a1822',
    msgOtherBg: '#231115',
  },
  Ember: {
    bgPrimary: '#1c110d',
    bgSecondary: '#150c09',
    bgTertiary: '#2b1913',
    accent: '#ff5a36',
    textPrimary: '#f4e6e0',
    textMuted: '#b39287',
    border: '#3b221a',
    msgMineBg: '#5a2216',
    msgOtherBg: '#241510',
  },
  Cherry: {
    bgPrimary: '#220d17',
    bgSecondary: '#190a11',
    bgTertiary: '#331424',
    accent: '#ff4d6d',
    textPrimary: '#f7e4ea',
    textMuted: '#b9899a',
    border: '#44182e',
    msgMineBg: '#5c1a36',
    msgOtherBg: '#2a101c',
  },
  Poppy: {
    bgPrimary: '#fff6f5',
    bgSecondary: '#fde9e7',
    bgTertiary: '#f8d6d3',
    accent: '#d92d2d',
    textPrimary: '#3d1f1f',
    textMuted: '#7d5555',
    border: '#f1c5c2',
    msgMineBg: '#fad2cf',
    msgOtherBg: '#fde9e7',
  },
  Forest: {
    bgPrimary: '#0f1a14',
    bgSecondary: '#0b130f',
    bgTertiary: '#18271e',
    accent: '#4cc27a',
    textPrimary: '#dfeee4',
    textMuted: '#8fae9a',
    border: '#1f3327',
    msgMineBg: '#1d4630',
    msgOtherBg: '#14221a',
  },
  Ocean: {
    bgPrimary: '#0b1a20',
    bgSecondary: '#08131a',
    bgTertiary: '#12272f',
    accent: '#1fb6c9',
    textPrimary: '#dcf0f3',
    textMuted: '#86a9b1',
    border: '#173540',
    msgMineBg: '#124a55',
    msgOtherBg: '#0f2129',
  },
  Amethyst: {
    bgPrimary: '#1a1326',
    bgSecondary: '#130e1d',
    bgTertiary: '#271c3a',
    accent: '#a56cff',
    textPrimary: '#ebe3f7',
    textMuted: '#a595c0',
    border: '#34264d',
    msgMineBg: '#3d2a66',
    msgOtherBg: '#201733',
  },
  Solar: {
    bgPrimary: '#002b36',
    bgSecondary: '#00212b',
    bgTertiary: '#073642',
    accent: '#2aa198',
    textPrimary: '#b6c2c2',
    textMuted: '#7f9498',
    border: '#0f4552',
    msgMineBg: '#0c4a55',
    msgOtherBg: '#00252f',
  },
  Gruvbox: {
    bgPrimary: '#282828',
    bgSecondary: '#1d2021',
    bgTertiary: '#3c3836',
    accent: '#d79921',
    textPrimary: '#ebdbb2',
    textMuted: '#a89984',
    border: '#504945',
    msgMineBg: '#4a4020',
    msgOtherBg: '#232323',
  },
  Tokyo: {
    bgPrimary: '#1a1b26',
    bgSecondary: '#16161e',
    bgTertiary: '#24283b',
    accent: '#7aa2f7',
    textPrimary: '#c0caf5',
    textMuted: '#838ab0',
    border: '#2a2e45',
    msgMineBg: '#2f3b66',
    msgOtherBg: '#1c1d2b',
  },
  Mint: {
    bgPrimary: '#f4fbf7',
    bgSecondary: '#e6f5ec',
    bgTertiary: '#d4ebde',
    accent: '#1f9d6b',
    textPrimary: '#1f3a2e',
    textMuted: '#56796a',
    border: '#c3e2d1',
    msgMineBg: '#cdeedd',
    msgOtherBg: '#e6f5ec',
  },
  Cloud: {
    bgPrimary: '#f5f8fc',
    bgSecondary: '#e8eef6',
    bgTertiary: '#d8e2ef',
    accent: '#2f6fdb',
    textPrimary: '#1f2d3f',
    textMuted: '#5b6e86',
    border: '#cbd7e6',
    msgMineBg: '#d3e2f8',
    msgOtherBg: '#e8eef6',
  },
};

for (const [name, spec] of Object.entries(EXTRA_THEME_SPECS)) {
  THEME_TOKENS[name] = buildThemeTokens(spec);
}

/** Built-in theme names, in the order they are offered. */
export const BUILTIN_THEME_NAMES: readonly string[] = [
  'Carbon',
  'Parrot',
  'Hallow',
  'Ethereal',
  ...Object.keys(EXTRA_THEME_SPECS),
];
