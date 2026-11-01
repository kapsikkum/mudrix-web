import { style, keyframes, styleVariants } from '@vanilla-extract/css';
import { BASE_LOGO, THEME_TOKENS, type ThemeLogoTokens } from '@/theme/themeTokens';

type ThemeKey = string;

// Carbon, then every built-in theme that has its own logo colours
const THEMES: ThemeKey[] = [
  'Carbon',
  ...Object.keys(THEME_TOKENS).filter(
    (name) => name !== 'Carbon' && THEME_TOKENS[name].logo !== BASE_LOGO
  ),
];

const rampOf = (logo: ThemeLogoTokens['logo']): string[] => [
  logo.p4,
  logo.p0,
  logo.p1,
  logo.p5,
  logo.hover,
];

const CYCLE = Object.fromEntries(
  THEMES.map((theme) => {
    const [c1, c2, c3, c4, c5] = rampOf(THEME_TOKENS[theme].logo);
    return [
      theme,
      keyframes({
        '0%': { fill: c2 },
        '16%': { fill: c4 },
        '33%': { fill: c5 },
        '50%': { fill: c4 },
        '66%': { fill: c3 },
        '83%': { fill: c1 },
        '100%': { fill: c2 },
      }),
    ];
  })
) as Record<ThemeKey, string>;

const DURATION = '2.4s';
const TIMING = 'ease-in-out';
const ITER = 'infinite';

// Facets of the same tone pulse together, staggered across the six tones
const DELAYS = ['0s', '-0.4s', '-0.8s', '-1.2s', '-1.6s', '-2.0s'];

const BASE = {
  animationDuration: DURATION,
  animationTimingFunction: TIMING,
  animationIterationCount: ITER,
} as const;

function toneVariants(index: number) {
  return styleVariants(
    Object.fromEntries(
      THEMES.map((theme) => [
        theme,
        { ...BASE, animationName: CYCLE[theme], animationDelay: DELAYS[index] },
      ])
    )
  );
}

// One variant set per mud facet tone (0 darkest .. 5 lightest)
export const tones = [
  toneVariants(0),
  toneVariants(1),
  toneVariants(2),
  toneVariants(3),
  toneVariants(4),
  toneVariants(5),
];

export const svg = style({
  width: '80px',
  height: '80px',
});
