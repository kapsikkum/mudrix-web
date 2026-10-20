import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const bannerPreview = style({
  position: 'relative',
  width: '100%',
  aspectRatio: '3 / 1',
  borderRadius: vars.radius.md,
  overflow: 'hidden',
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
});

export const bannerImg = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

export const bannerEmpty = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: vars.color.textMuted,
  fontSize: '0.85rem',
});

export const bannerActions = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '8px',
  marginTop: '8px',
});

export const positionRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginTop: '8px',
  fontSize: '0.85rem',
  color: vars.color.textSecondary,
});

export const positionSlider = style({
  flex: 1,
  accentColor: vars.color.accent,
});

export const saveRow = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
});

export const unsupportedNote = style({
  padding: '10px 12px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  fontSize: '0.85rem',
  color: vars.color.textSecondary,
  lineHeight: 1.5,
});
