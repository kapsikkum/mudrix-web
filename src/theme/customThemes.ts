import { vars } from './vars.css';
import {
  BUILTIN_THEME_NAMES,
  THEME_SPEC_KEYS,
  THEME_TOKENS,
  buildThemeTokens,
  isHexColor,
  isLightColor,
  type ThemeColorTokens,
  type ThemeSpec,
} from './themeTokens';

/** A theme made by the user: a name and a handful of colours (the rest is derived). */
export interface CustomTheme {
  id: string;
  name: string;
  colors: ThemeSpec;
}

export const CUSTOM_THEME_PREFIX = 'custom:';
export const MAX_CUSTOM_THEMES = 20;
const MAX_NAME_LENGTH = 40;

export function isCustomThemeName(name: string): boolean {
  return name.startsWith(CUSTOM_THEME_PREFIX);
}

export function customThemeName(id: string): string {
  return `${CUSTOM_THEME_PREFIX}${id}`;
}

export function newCustomThemeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// The theme list is state in jotai; this mirror lets non-React code (call embeds, the sticker
// picker, ...) resolve a custom theme by name. App keeps it in step with the atom.
let registry: CustomTheme[] = [];

export function setCustomThemeRegistry(list: CustomTheme[]): void {
  registry = list;
}

const tokenCache = new Map<string, ThemeColorTokens>();

function tokensFor(theme: CustomTheme): ThemeColorTokens {
  const key = `${theme.id}:${THEME_SPEC_KEYS.map((k) => theme.colors[k]).join('')}`;
  let tokens = tokenCache.get(key);
  if (!tokens) {
    if (tokenCache.size > 200) tokenCache.clear();
    tokens = buildThemeTokens(theme.colors);
    tokenCache.set(key, tokens);
  }
  return tokens;
}

/** Tokens of a built-in or custom theme by name; an unknown name falls back to Carbon. */
export function resolveThemeTokens(name: string): ThemeColorTokens {
  if (isCustomThemeName(name)) {
    const id = name.slice(CUSTOM_THEME_PREFIX.length);
    const custom = registry.find((t) => t.id === id);
    if (custom) return tokensFor(custom);
  }
  return THEME_TOKENS[name] ?? THEME_TOKENS.Carbon;
}

export function isLightTheme(name: string): boolean {
  return isLightColor(resolveThemeTokens(name).color.bgPrimary);
}

export function isKnownTheme(name: string, customThemes: readonly CustomTheme[]): boolean {
  if (BUILTIN_THEME_NAMES.includes(name)) return true;
  return isCustomThemeName(name) && customThemes.some((t) => customThemeName(t.id) === name);
}

function parseColors(raw: unknown): ThemeSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const out: Partial<ThemeSpec> = {};
  for (const key of THEME_SPEC_KEYS) {
    const value = input[key];
    if (!isHexColor(value)) return null;
    out[key] = value.toLowerCase();
  }
  return out as ThemeSpec;
}

function cleanName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) : '';
}

/** Keeps well-formed custom themes only (used for synced and stored data alike). */
export function sanitizeCustomThemes(raw: unknown): CustomTheme[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomTheme[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (out.length >= MAX_CUSTOM_THEMES) break;
    if (!entry || typeof entry !== 'object') continue;
    const { id, name, colors } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[a-z0-9]{6,32}$/.test(id) || seen.has(id)) continue;
    const parsed = parseColors(colors);
    const cleaned = cleanName(name);
    if (!parsed || !cleaned) continue;
    seen.add(id);
    out.push({ id, name: cleaned, colors: parsed });
  }
  return out;
}

/** A theme pasted from another person: `{ "name": "...", "colors": { ... } }`. */
export function parseSharedTheme(text: string): { name: string; colors: ThemeSpec } | null {
  try {
    const data = JSON.parse(text) as { name?: unknown; colors?: unknown };
    const colors = parseColors(data?.colors);
    const name = cleanName(data?.name);
    return colors && name ? { name, colors } : null;
  } catch {
    return null;
  }
}

export function serializeTheme(theme: CustomTheme): string {
  return JSON.stringify({ name: theme.name, colors: theme.colors }, null, 2);
}

// --- Applying a custom theme ---------------------------------------------------------------------

const appliedProps = new Set<string>();

function cssVarName(reference: string): string | null {
  const m = /var\((--[^,)]+)/.exec(reference);
  return m ? m[1] : null;
}

/**
 * Paints a custom theme by overriding the theme variables on the root element (built-in themes
 * are static classes). Passing null removes the overrides again.
 */
export function applyCustomThemeVars(tokens: ThemeColorTokens | null): void {
  const root = document.documentElement;
  appliedProps.forEach((prop) => root.style.removeProperty(prop));
  appliedProps.clear();
  if (!tokens) return;
  for (const key of Object.keys(tokens.color) as (keyof ThemeColorTokens['color'])[]) {
    const prop = cssVarName(vars.color[key]);
    if (!prop) continue;
    root.style.setProperty(prop, tokens.color[key]);
    appliedProps.add(prop);
  }
}
