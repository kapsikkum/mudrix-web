import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const preview = style({
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: '10px 0',
  marginBottom: '8px',
  userSelect: 'none',
});

export const previewSender = style({
  fontWeight: 600,
  color: vars.color.accent,
  fontSize: '0.9rem',
});

export const swatchRow = style({
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
});

export const swatch = style({
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  border: `1px solid ${vars.color.border}`,
  padding: 0,
  cursor: 'pointer',
  outline: '2px solid transparent',
  outlineOffset: '2px',
  transition: `outline-color ${fast}, transform ${fast}`,
  ':hover': { transform: 'scale(1.08)' },
  ':focus-visible': { outlineColor: vars.color.accent },
});

export const swatchActive = style([swatch, { outlineColor: vars.color.accent }]);
