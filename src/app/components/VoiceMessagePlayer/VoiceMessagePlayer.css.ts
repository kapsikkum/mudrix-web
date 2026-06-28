import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const player = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  maxWidth: '220px',
  width: '220px',
});

export const playBtn = style({
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
  backgroundColor: vars.color.accent,
  color: '#fff',
  transition: `background-color ${fast}, transform ${fast}`,
  ':hover': { backgroundColor: vars.color.accentHover, transform: 'scale(1.06)' },
});

export const waveformWrap = style({
  flex: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  alignSelf: 'stretch',
});

export const waveformLoading = style({
  width: '100%',
  height: '44px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
});

export const time = style({
  fontSize: '0.78rem',
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
  minWidth: '34px',
  textAlign: 'right',
});
