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

export const popoverLayerFixed = style({
  position: 'fixed',
  zIndex: 5000,
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
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
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

export const emojiBtn = style([attachBtn]);

export const emojiBtnActive = style([
  attachBtn,
  {
    color: vars.color.accent,
    ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.accent },
  },
]);

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

export const moreBtn = style({
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

export const moreBtnActive = style([
  moreBtn,
  {
    color: vars.color.accent,
    ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.accent },
  },
]);

export const moreMenu = style({
  position: 'absolute',
  bottom: '100%',
  right: '0',
  marginBottom: '8px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
  overflow: 'hidden',
  zIndex: 200,
  minWidth: '160px',
});

export const moreMenuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '10px 14px',
  border: 'none',
  background: 'none',
  color: vars.color.textPrimary,
  fontSize: '0.88rem',
  cursor: 'pointer',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  transition: `background-color ${fast}`,
  ':hover': { backgroundColor: vars.color.bgHover },
});

export const linkPopover = style({
  position: 'absolute',
  zIndex: 5000,
  transform: 'translateY(calc(-100% - 8px))',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '10px 12px',
  backgroundColor: vars.color.bgPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
});

export const linkLabel = style({
  fontSize: '0.72rem',
  fontWeight: 600,
  color: vars.color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
});

export const linkInput = style({
  width: '240px',
  padding: '6px 8px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  outline: 'none',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  transition: `border-color ${fast}, box-shadow ${fast}`,
  ':focus': {
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px color-mix(in srgb, ${vars.color.accent} 18%, transparent)`,
  },
  '::placeholder': { color: vars.color.textMuted },
});

export const linkActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '6px',
});

const linkBtnBase = style({
  padding: '5px 14px',
  borderRadius: vars.radius.sm,
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.82rem',
  fontWeight: 600,
  transition: `background-color ${fast}, color ${fast}`,
});

export const linkApply = style([
  linkBtnBase,
  {
    backgroundColor: vars.color.accent,
    color: '#fff',
    ':hover': { backgroundColor: vars.color.accentHover },
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
  },
]);

export const linkCancel = style([
  linkBtnBase,
  {
    backgroundColor: 'transparent',
    color: vars.color.textMuted,
    ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
  },
]);
