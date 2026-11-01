import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fontSize } from '@/theme/typeScale';

export const card = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginTop: '8px',
  padding: '8px 10px',
  maxWidth: '360px',
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgSecondary,
});

export const icon = style({
  width: '32px',
  height: '32px',
  flexShrink: 0,
  borderRadius: vars.radius.md,
  objectFit: 'cover',
});

export const text = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
  flex: 1,
});

export const title = style({
  fontSize: fontSize.px13,
  fontWeight: 600,
  color: vars.color.textPrimary,
  overflowWrap: 'anywhere',
});

export const subtitle = style({
  fontSize: fontSize.px12,
  color: vars.color.textSecondary,
  overflowWrap: 'anywhere',
});

export const via = style({
  fontSize: fontSize.px12,
  color: vars.color.textMuted,
});

export const button = style({
  flexShrink: 0,
  padding: '4px 10px',
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  fontSize: fontSize.px12,
  color: vars.color.accent,
  textDecoration: 'none',
  ':hover': { backgroundColor: vars.color.bgHover },
});
