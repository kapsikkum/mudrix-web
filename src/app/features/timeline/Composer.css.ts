import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const composerWrap = style({
  backgroundColor: vars.color.bgPrimary,
  padding: '8px 12px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  flexShrink: 0,
  position: 'relative',
});

export const hiddenInput = style({
  display: 'none',
});

export const stickerWrap = style({
  position: 'relative',
});

export const replyPreview = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  backgroundColor: vars.color.bgTertiary,
  borderRadius: vars.radius.md,
  borderLeft: `3px solid ${vars.color.accent}`,
  fontSize: '0.88rem',
  color: vars.color.textMuted,
  marginBottom: '2px',
});

export const replyCancel = style({
  marginLeft: 'auto',
  background: 'none',
  border: 'none',
  color: vars.color.textMuted,
  cursor: 'pointer',
  fontSize: '1rem',
  lineHeight: 1,
  padding: '2px 4px',
  borderRadius: vars.radius.sm,
  ':hover': { color: vars.color.textPrimary, backgroundColor: vars.color.bgHover },
});

export const floatingToolbar = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: '4px 6px',
  backgroundColor: vars.color.bgPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
  zIndex: 200,
  pointerEvents: 'auto',
});

export const fmtBtn = style({
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  fontSize: '0.82rem',
  flexShrink: 0,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
});

export const fmtBtnActive = style({
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  color: vars.color.accent,
  fontSize: '0.82rem',
  flexShrink: 0,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.accent },
});

export const inputRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  backgroundColor: vars.color.bgInput,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  padding: '4px',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  ':focus-within': {
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px color-mix(in srgb, ${vars.color.accent} 18%, transparent)`,
  },
});

export const attachBtn = style({
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  fontSize: '0.95rem',
  flexShrink: 0,
  transition: 'background-color 0.15s, color 0.15s',
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
});

export const textarea = style({
  flex: 1,
  resize: 'none',
  minHeight: '32px',
  maxHeight: '180px',
  padding: '6px 8px',
  backgroundColor: 'transparent',
  color: vars.color.textPrimary,
  border: 'none',
  outline: 'none',
  fontSize: '0.97rem',
  lineHeight: '1.5',
  fontFamily: 'inherit',
  overflowY: 'hidden',
  '::placeholder': { color: vars.color.textMuted },
});

export const sendBtn = style({
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: vars.color.accent,
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.82rem',
  flexShrink: 0,
  transition: 'background-color 0.15s, transform 0.1s',
  ':hover': { backgroundColor: vars.color.accentHover, transform: 'scale(1.08)' },
  ':disabled': { opacity: 0.4, cursor: 'not-allowed', transform: 'none' },
});

export const sendBtnIcon = style({
  transform: 'rotate(90deg)',
});

export const emojiBtn = style([
  attachBtn,
  {
    '@media': {
      '(pointer: coarse)': {
        display: 'none',
      },
    },
  },
]);

export const emojiBtnActive = style([
  attachBtn,
  {
    color: vars.color.accent,
    ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.accent },
    '@media': {
      '(pointer: coarse)': {
        display: 'none',
      },
    },
  },
]);

export const stickerBtn = style([attachBtn, { position: 'relative' }]);

export const stickerBtnActive = style([
  attachBtn,
  {
    position: 'relative',
    color: vars.color.accent,
    backgroundColor: vars.color.bgActive,
    ':hover': { backgroundColor: vars.color.bgActive },
  },
]);

export const dropZone = style({
  position: 'absolute',
  inset: 0,
  backgroundColor: `rgba(${vars.color.accentRgb}, 0.12)`,
  border: `2px dashed ${vars.color.accent}`,
  borderRadius: vars.radius.lg,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  color: vars.color.accent,
  fontSize: '1.1rem',
  fontWeight: 600,
  zIndex: 100,
  pointerEvents: 'none',
  backdropFilter: 'blur(2px)',
});
