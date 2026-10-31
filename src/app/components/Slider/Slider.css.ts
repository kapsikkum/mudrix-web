import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';
import { fontSize } from '@/theme/typeScale';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  width: '240px',
});

export const ticks = style({
  position: 'relative',
  height: '16px',
});

export const tick = style({
  position: 'absolute',
  top: 0,
  transform: 'translateX(-50%)',
  padding: 0,
  border: 'none',
  background: 'none',
  fontSize: fontSize.rem72,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: '16px',
  color: vars.color.textMuted,
  cursor: 'pointer',
  transition: `color ${fast}`,
  ':hover': { color: vars.color.textPrimary },
});

export const tickDefault = style([tick, { color: vars.color.accent }]);
