import { createTheme } from '@vanilla-extract/css';
import { vars } from './vars.css';
import { THEME_TOKENS } from './themeTokens';

export const defaultTheme = createTheme(vars, THEME_TOKENS.Carbon);

export const parrotTheme = createTheme(vars, THEME_TOKENS.Parrot);

export const etherealTheme = createTheme(vars, THEME_TOKENS.Ethereal);

export const THEMES: Record<string, string> = {
  Carbon: defaultTheme,
  Parrot: parrotTheme,
  Ethereal: etherealTheme,
};

export const DEFAULT_THEME = 'Carbon';
