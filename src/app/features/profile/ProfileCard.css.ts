import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

/**
 * Styles for the profile card extras (mutual rooms, status, badges, decoration, effects, bio).
 * `--card-accent` is set inline on the popup when the user picked an accent colour; every use
 * has a theme fallback, and text is never placed directly on the raw accent colour.
 */

const accentTint = (percent: number) =>
  `color-mix(in srgb, var(--card-accent, ${vars.color.bgTertiary}) ${percent}%, ${vars.color.bgTertiary})`;
const accentText = `color-mix(in srgb, var(--card-accent, ${vars.color.accent}) 65%, ${vars.color.textPrimary})`;

// --- Mutual rooms ----------------------------------------------------------------------------

export const mutualRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '8px 10px',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textPrimary,
  fontSize: '0.8rem',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:hover': { backgroundColor: vars.color.bgHover },
    '&:focus-visible': { outline: `2px solid ${vars.color.accent}`, outlineOffset: '1px' },
  },
});

export const mutualAvatars = style({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
});

export const mutualAvatar = style({
  display: 'inline-flex',
  borderRadius: '50%',
  lineHeight: 0,
  boxShadow: `0 0 0 2px ${vars.color.bgTertiary}`,
  selectors: {
    '& + &': { marginLeft: '-6px' },
  },
});

export const mutualLabel = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 500,
});

export const mutualList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const mutualHeading = style({
  margin: '8px 0 4px',
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: vars.color.textMuted,
  selectors: {
    '&:first-child': { marginTop: 0 },
  },
});

export const mutualItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '6px 8px',
  borderRadius: vars.radius.sm,
  border: '1px solid transparent',
  backgroundColor: 'transparent',
  color: vars.color.textPrimary,
  fontSize: '0.9rem',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:hover': { backgroundColor: vars.color.bgTertiary },
    '&:focus-visible': { outline: `2px solid ${vars.color.accent}`, outlineOffset: '-2px' },
  },
});

export const mutualItemName = style({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const mutualNote = style({
  margin: 0,
  fontSize: '0.75rem',
  color: vars.color.textMuted,
});

// --- Status ----------------------------------------------------------------------------------

export const statusPill = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  maxWidth: '100%',
  padding: '3px 10px',
  borderRadius: '999px',
  fontSize: '0.8rem',
  lineHeight: 1.3,
  color: vars.color.textPrimary,
  backgroundColor: accentTint(18),
  border: `1px solid ${vars.color.border}`,
});

export const statusEmoji = style({
  flexShrink: 0,
  fontSize: '1rem',
  lineHeight: 1,
});

export const statusText = style({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const statusEmojiRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
});

export const statusEmojiBtn = style({
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgTertiary,
  fontSize: '1.1rem',
  lineHeight: 1,
  cursor: 'pointer',
  selectors: {
    '&:hover': { backgroundColor: vars.color.bgHover },
    '&[aria-pressed="true"]': {
      borderColor: vars.color.accent,
      backgroundColor: vars.color.bgActive,
    },
  },
});

// --- Badges ----------------------------------------------------------------------------------

export const badgeRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap',
});

export const badge = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  cursor: 'default',
});

// --- Avatar decoration -----------------------------------------------------------------------

export const decorated = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const decoration = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '120%',
  height: '120%',
  maxWidth: 'none',
  maxHeight: 'none',
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 1,
});

// --- Profile effect --------------------------------------------------------------------------

export const effectCanvas = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: 5,
  borderRadius: 'inherit',
});

export const profileEffectContainer = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  overflow: 'visible',
  zIndex: 10,
  borderRadius: 'inherit',
});

export const profileEffectLayer = style({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'fill',
  pointerEvents: 'none',
  userSelect: 'none',
  maxWidth: 'none',
  maxHeight: 'none',
});

// --- Bio -------------------------------------------------------------------------------------

export const bioBox = style({
  display: 'flex',
  flexDirection: 'column',
  fontSize: '0.85rem',
  color: vars.color.textPrimary,
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  padding: '8px 10px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  borderLeft: `3px solid var(--card-accent, ${vars.color.border})`,
});

export const bioClamped = style({
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

export const viewBioButton = style({
  alignSelf: 'flex-start',
  marginTop: '4px',
  padding: 0,
  border: 'none',
  background: 'none',
  color: accentText,
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  selectors: {
    '&:hover': { textDecoration: 'underline' },
    '&:focus-visible': { outline: `2px solid ${vars.color.accent}`, outlineOffset: '2px' },
  },
});

export const fullBio = style({
  fontSize: '0.9rem',
  color: vars.color.textPrimary,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
});

// --- Accent-aware card chrome ----------------------------------------------------------------

/** Fades the banner image into the card; tinted with the accent when one is set. */
export const coverTint = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: `linear-gradient(to bottom, transparent 55%, color-mix(in srgb, var(--card-accent, transparent) 35%, transparent))`,
});

export const memberSince = style({
  color: vars.color.textPrimary,
  fontWeight: 500,
});
