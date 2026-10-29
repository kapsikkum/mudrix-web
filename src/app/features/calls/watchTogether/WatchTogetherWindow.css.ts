import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

/** Above the fullscreen call (6000), below the incoming-call overlay (8500). */
const PANEL_Z = 7000;

export const panel = style({
  position: 'fixed',
  top: '56px',
  right: '24px',
  width: '440px',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: vars.radius.md,
  overflow: 'hidden',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  zIndex: PANEL_Z,
  '@media': {
    '(max-width: 768px)': {
      top: '8px',
      right: '8px',
      left: '8px',
      width: 'auto',
    },
  },
});

export const panelLarge = style({
  width: '720px',
  maxWidth: 'calc(100vw - 16px)',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 6px 6px 12px',
  cursor: 'grab',
  userSelect: 'none',
  touchAction: 'none',
  color: vars.color.textSecondary,
  fontSize: '0.8rem',
  selectors: {
    '&:active': { cursor: 'grabbing' },
  },
});

export const headerTitle = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const headerButtons = style({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
});

export const headerButton = style({
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  cursor: 'pointer',
  textDecoration: 'none',
  transition: `background-color ${fast}, color ${fast}`,
  selectors: {
    '&:hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
    '&:focus-visible': { outline: `2px solid ${vars.color.accent}`, outlineOffset: 1 },
  },
});

export const headerStop = style([
  headerButton,
  {
    selectors: {
      '&:hover': { backgroundColor: vars.color.bgHover, color: vars.color.danger },
    },
  },
]);

export const player = style({
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  backgroundColor: '#000',
});

export const playerHost = style({
  position: 'absolute',
  inset: 0,
});

globalStyle(`${playerHost} iframe`, {
  width: '100%',
  height: '100%',
  border: 'none',
  display: 'block',
});

export const playerError = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  textAlign: 'center',
  color: '#fff',
  fontSize: '0.9rem',
  backgroundColor: 'rgba(0,0,0,0.75)',
  pointerEvents: 'none',
});

export const invite = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
  padding: '20px 16px',
  textAlign: 'center',
});

export const inviteIcon = style({ color: vars.color.accent });

export const inviteTitle = style({
  margin: 0,
  color: vars.color.textPrimary,
  fontWeight: 600,
});

export const inviteBody = style({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: '0.85rem',
});

export const inviteActions = style({ display: 'flex', gap: '8px' });

export const inviteButton = style({
  height: '34px',
  boxSizing: 'border-box',
  padding: '0 16px',
  border: 'none',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.accent,
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  transition: `filter ${fast}`,
  selectors: {
    '&:hover': { filter: 'brightness(1.1)' },
    '&:focus-visible': { outline: `2px solid ${vars.color.textPrimary}`, outlineOffset: 2 },
  },
});

export const inviteSecondary = style([
  inviteButton,
  { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
]);

export const inviteLink = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  color: vars.color.textMuted,
  fontSize: '0.8rem',
  textDecoration: 'none',
  selectors: { '&:hover': { color: vars.color.textPrimary } },
});

export const dialogBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

export const dialogNote = style({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: '0.85rem',
});
