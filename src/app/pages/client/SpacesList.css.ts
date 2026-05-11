import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const spacesList = style({
  width: '66px',
  backgroundColor: vars.color.bgPrimary,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: '8px',
  gap: '4px',
  borderRight: `1px solid ${vars.color.border}`,
  overflowY: 'auto',
  flexShrink: 0,
});

// Base for all sidebar icon buttons (Home, DMs, spaces)
const spaceBtnBase = style({
  width: '44px',
  height: '44px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  fontSize: '0.9rem',
  fontWeight: 700,
  transition: 'border-radius 0.2s ease, background-color 0.15s, box-shadow 0.15s',
  position: 'relative',
  flexShrink: 0,
  overflow: 'hidden',
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textMuted,
  ':hover': {
    borderRadius: vars.radius.md,
    color: vars.color.textPrimary,
  },
});

export const spaceBtn = style([spaceBtnBase, {}]);

export const spaceBtnActive = style([
  spaceBtnBase,
  {
    borderRadius: vars.radius.md,
    boxShadow: `0 0 0 2px ${vars.color.accent}`,
  },
]);

export const spaceBtnHome = style([
  spaceBtnBase,
  {
    borderRadius: vars.radius.md,
    backgroundColor: vars.color.accent,
    color: '#fff',
    ':hover': {
      borderRadius: vars.radius.md,
      backgroundColor: vars.color.accentHover,
    },
  },
]);

export const spaceBtnDm = style([
  spaceBtnBase,
  {
    borderRadius: vars.radius.md,
    backgroundColor: vars.color.accent,
    color: '#fff',
    ':hover': {
      borderRadius: vars.radius.md,
      backgroundColor: vars.color.accentHover,
    },
  },
]);

export const spacesSeparator = style({
  width: '32px',
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '4px 0',
});

export const spaceBtnInvite = style([
  spaceBtnBase,
  {
    boxShadow: `0 0 0 2px ${vars.color.accent}`,
    borderRadius: vars.radius.md,
  },
]);

export const inviteDot = style({
  position: 'absolute',
  top: '4px',
  right: '4px',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  border: `2px solid ${vars.color.bgPrimary}`,
});
