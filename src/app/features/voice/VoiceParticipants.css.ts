import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

const ringPulse = keyframes({
  '0%': { boxShadow: `0 0 0 0 rgba(59,165,93,0.7)` },
  '60%': { boxShadow: `0 0 0 3px rgba(59,165,93,0)` },
  '100%': { boxShadow: `0 0 0 0 rgba(59,165,93,0)` },
});

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
  transition: 'background-color 0.1s',
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
    outlineOffset: '1px',
    animationName: ringPulse,
    animationDuration: '1.2s',
    animationTimingFunction: 'ease-out',
    animationIterationCount: 'infinite',
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

export const iconMuted = style({
  color: vars.color.error,
  fontSize: '0.68rem',
  opacity: 0.9,
});

export const iconVideo = style({
  color: vars.color.success,
  fontSize: '0.68rem',
  opacity: 0.9,
});

export const iconScreenshare = style({
  color: vars.color.accent,
  fontSize: '0.68rem',
  opacity: 0.9,
});

export const externalBadge = style({
  fontSize: '0.6rem',
  color: vars.color.textSecondary,
  opacity: 0.6,
});
