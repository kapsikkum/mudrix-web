import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 7000,
  backdropFilter: 'blur(4px)',
});

export const dialog = style({
  position: 'relative',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  width: '100%',
  maxWidth: '480px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px 12px',
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const headerTitle = style({
  fontSize: '0.95rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const closeBtn = style({
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s, color 0.15s',
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.textPrimary,
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
  transition: 'border-color 0.15s, box-shadow 0.15s',
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

export const mutedText = style({
  color: vars.color.textMuted,
  fontSize: '0.9rem',
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

export const iconMargin = style({
  marginRight: '6px',
});

export const sendIcon = style({
  marginRight: '6px',
  transform: 'rotate(90deg)',
});

export const uploadingOverlay = style({
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  color: '#fff',
  fontSize: '0.9rem',
  borderRadius: vars.radius.lg,
  zIndex: 10,
});
