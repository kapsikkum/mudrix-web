import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const wrap = style({
  display: 'flex',
  flexDirection: 'column',
  padding: '1px 8px 4px 36px',
  gap: '1px',
});

const entryBase = style({
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  padding: '3px 6px 3px 4px',
  borderRadius: vars.radius.sm,
  fontSize: '0.82rem',
  color: vars.color.textMuted,
  cursor: 'default',
  transition: `background-color ${fast}`,
  ':hover': { backgroundColor: vars.color.bgHover },
});

export const entry = entryBase;

export const entrySpeaking = style([entryBase, { color: vars.color.textPrimary }]);

const ringBase = style({
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  overflow: 'hidden',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.6rem',
  fontWeight: 700,
});

export const avatarRing = ringBase;

export const avatarRingSpeaking = style([
  ringBase,
  {
    outline: `2px solid ${vars.color.success}`,
  },
]);

export const name = style({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '0.82rem',
});

export const icons = style({
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  flexShrink: 0,
  marginLeft: 'auto',
});

export const iconAnimated = style({
  transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
});

export const iconVisible = style({
  opacity: 0.9,
  transform: 'scale(1)',
});

export const iconHidden = style({
  opacity: 0,
  transform: 'scale(0)',
  pointerEvents: 'none',
});

export const iconMuted = style({
  color: vars.color.error,
  fontSize: '0.68rem',
  display: 'inline-flex',
  alignItems: 'center',
});

export const iconVideo = style({
  color: vars.color.success,
  fontSize: '0.68rem',
  display: 'inline-flex',
  alignItems: 'center',
});

export const iconScreenshare = style({
  color: vars.color.accent,
  fontSize: '0.68rem',
  display: 'inline-flex',
  alignItems: 'center',
});

export const externalBadge = style({
  fontSize: '0.6rem',
  color: vars.color.textSecondary,
  opacity: 0.6,
  display: 'inline-flex',
  alignItems: 'center',
});
