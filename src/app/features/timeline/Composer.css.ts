import { style, globalStyle } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast, med } from '@/theme/animations.css';

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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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
  minWidth: 0,
  overflowX: 'hidden',
  backgroundColor: vars.color.bgInput,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  padding: '4px',
  transition: `border-color ${fast}, box-shadow ${fast}`,
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
  transition: `background-color ${fast}, color ${fast}`,
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

// Slate contentEditable editor replacing the textarea in the composer.
export const richEditor = style({
  flex: 1,
  minWidth: 0,
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
  overflowY: 'auto',
  overflowX: 'hidden',
  wordBreak: 'break-word',
});

globalStyle(`${richEditor} p`, { margin: 0 });
globalStyle(`${richEditor} p + p`, { marginTop: '2px' });
globalStyle(`${richEditor} blockquote`, {
  margin: '2px 0',
  paddingLeft: '10px',
  borderLeft: `3px solid ${vars.color.accent}`,
  color: vars.color.textMuted,
});
globalStyle(`${richEditor} pre`, {
  margin: '2px 0',
  padding: '4px 8px',
  backgroundColor: vars.color.bgTertiary,
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '0.9em',
  overflowX: 'auto',
});
globalStyle(`${richEditor} code`, {
  backgroundColor: vars.color.bgTertiary,
  borderRadius: '3px',
  padding: '1px 4px',
  fontFamily: 'monospace',
  fontSize: '0.9em',
});
globalStyle(`${richEditor} a`, {
  color: vars.color.accent,
  textDecoration: 'underline',
  cursor: 'pointer',
});
globalStyle(`${richEditor} [data-slate-placeholder]`, {
  color: `${vars.color.textMuted} !important`,
  pointerEvents: 'none',
  userSelect: 'none',
  opacity: '1 !important',
  top: '6px !important',
  left: '8px !important',
});
globalStyle(`${richEditor} .mention-pill`, {
  display: 'inline-block',
  backgroundColor: `color-mix(in srgb, ${vars.color.accent} 15%, transparent)`,
  color: vars.color.accent,
  borderRadius: '4px',
  padding: '0 4px',
  fontSize: '0.9em',
  fontWeight: 600,
  userSelect: 'none',
  cursor: 'default',
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
  transition: `background-color ${fast}, transform ${fast}`,
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

export const uploadProgressBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '0 12px',
  height: '32px',
  backgroundColor: vars.color.bgTertiary,
  borderRadius: vars.radius.sm,
  flexShrink: 0,
  position: 'relative',
  overflow: 'hidden',
});

export const uploadProgressLabel = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flexShrink: 1,
  minWidth: 0,
  position: 'relative',
  zIndex: 1,
});

export const uploadCancelBtn = style({
  position: 'relative',
  zIndex: 1,
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  marginLeft: 'auto',
  transition: `background-color ${fast}, color ${fast}`,
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.textPrimary,
  },
});

export const uploadProgressFill = style({
  position: 'absolute',
  inset: 0,
  backgroundColor: vars.color.accent,
  opacity: 0.15,
  transition: `width ${med} ease`,
});
