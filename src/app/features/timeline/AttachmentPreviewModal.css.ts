import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const dialog = style({
  selectors: {
    '&&': {
      borderRadius: vars.radius.lg,
      boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
    },
  },
});

export const dialogBody = style({
  selectors: {
    '&&': {
      padding: 0,
      gap: 0,
      overflow: 'hidden',
    },
  },
});

export const list = style({
  maxHeight: 'min(60vh, 420px)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '14px 16px',
});

export const item = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '10px',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgTertiary,
});

export const thumb = style({
  width: '64px',
  height: '64px',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgPrimary,
  overflow: 'hidden',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const thumbMedia = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

export const thumbIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: vars.color.accent,
  width: '100%',
  height: '100%',
});

export const itemBody = style({
  minWidth: 0,
  flex: 1,
});

export const fileMeta = style({
  minWidth: 0,
  marginBottom: '8px',
});

export const fileName = style({
  fontSize: '0.9rem',
  fontWeight: 500,
  color: vars.color.textPrimary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const fileSize = style({
  fontSize: '0.78rem',
  color: vars.color.textMuted,
  marginTop: '2px',
});

export const fileSizeOversized = style({
  fontSize: '0.78rem',
  color: vars.color.error,
  marginTop: '2px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const captionInput = style({
  width: '100%',
  boxSizing: 'border-box',
  resize: 'none',
  minHeight: '32px',
  maxHeight: '96px',
  padding: '6px 10px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  outline: 'none',
  fontSize: '0.85rem',
  lineHeight: '1.4',
  fontFamily: 'inherit',
  transition: `border-color ${fast}, box-shadow ${fast}`,
  '::placeholder': { color: vars.color.textMuted },
  ':focus': {
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px color-mix(in srgb, ${vars.color.accent} 18%, transparent)`,
  },
});

export const removeBtn = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '26px',
  height: '26px',
  borderRadius: vars.radius.sm,
  border: 'none',
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  cursor: 'pointer',
  flexShrink: 0,
  transition: `background-color ${fast}, color ${fast}`,
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.error,
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
  },
});

export const footer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 16px',
  borderTop: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});
