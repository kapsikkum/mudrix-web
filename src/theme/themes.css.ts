import { assignVars, createTheme, style } from '@vanilla-extract/css';
import { vars } from './vars.css';
import { BASE_LOGO, BUILTIN_THEME_NAMES, THEME_TOKENS } from './themeTokens';

export const defaultTheme = createTheme(vars, THEME_TOKENS.Carbon);

export const parrotTheme = createTheme(vars, THEME_TOKENS.Parrot);

export const hallowTheme = createTheme(vars, THEME_TOKENS.Hallow);

export const etherealTheme = createTheme(vars, THEME_TOKENS.Ethereal);

export const baseLogoClass = style({ vars: assignVars(vars.logo, BASE_LOGO) });

export const THEMES: Record<string, string> = {
  Carbon: defaultTheme,
  Parrot: parrotTheme,
  Hallow: hallowTheme,
  Ethereal: etherealTheme,
};
for (const name of BUILTIN_THEME_NAMES) {
  if (!(name in THEMES)) THEMES[name] = createTheme(vars, THEME_TOKENS[name]);
}

export const DEFAULT_THEME = 'Carbon';
