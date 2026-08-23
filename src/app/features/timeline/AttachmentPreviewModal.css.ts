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

export const previewArea = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: vars.color.bgPrimary,
  minHeight: '180px',
  maxHeight: '320px',
  overflow: 'hidden',
  flexShrink: 0,
  position: 'relative',
});

export const previewImage = style({
  maxWidth: '100%',
  maxHeight: '320px',
  objectFit: 'contain',
  display: 'block',
});

export const previewVideo = style({
  maxWidth: '100%',
  maxHeight: '320px',
  display: 'block',
  outline: 'none',
});

export const previewAudio = style({
  maxWidth: '100%',
  display: 'block',
  outline: 'none',
});

export const fileInfo = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const fileIconWrap = style({
  width: '40px',
  height: '40px',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgTertiary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: vars.color.accent,
  flexShrink: 0,
});

export const fileMeta = style({
  minWidth: 0,
  flex: 1,
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

export const captionArea = style({
  padding: '12px 16px',
  flexShrink: 0,
});

export const captionInput = style({
  width: '100%',
  boxSizing: 'border-box',
  resize: 'none',
  minHeight: '60px',
  maxHeight: '120px',
  padding: '10px 12px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  outline: 'none',
  fontSize: '0.93rem',
  lineHeight: '1.5',
  fontFamily: 'inherit',
  transition: `border-color ${fast}, box-shadow ${fast}`,
  '::placeholder': { color: vars.color.textMuted },
  ':focus': {
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px color-mix(in srgb, ${vars.color.accent} 18%, transparent)`,
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

export const genericFilePreview = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  minHeight: '180px',
});

export const genericFileIcon = style({
  width: '80px',
  height: '80px',
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.bgTertiary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: vars.color.accent,
});

export const fileSizeOversized = style({
  fontSize: '0.78rem',
  color: vars.color.error,
  marginTop: '2px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});
