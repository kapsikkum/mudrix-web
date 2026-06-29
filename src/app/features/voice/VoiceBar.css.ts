import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const bar = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  backgroundColor: vars.color.bgTertiary,
  borderTop: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const status = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
});

export const connectedRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
});

export const signalIcon = style({
  color: vars.color.success,
  fontSize: '0.72rem',
  flexShrink: 0,
});
export const signalOk = style([signalIcon, { color: '#faa81a' }]);
export const signalPoor = style([signalIcon, { color: vars.color.error }]);

export const connected = style({
  fontSize: '0.72rem',
  color: vars.color.success,
  fontWeight: 700,
  letterSpacing: '0.04em',
});

export const roomName = style({
  fontSize: '0.84rem',
  color: vars.color.textPrimary,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const controls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  flexShrink: 0,
});

export const ctrl = style({
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  color: vars.color.textMuted,
  fontSize: '0.85rem',
  backgroundColor: 'transparent',
  transition: `background-color ${fast}, color ${fast}`,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
});

export const ctrlOff = style([
  ctrl,
  { color: '#ff6b6b', ':hover': { backgroundColor: 'rgba(255,107,107,0.12)', color: '#ff6b6b' } },
]);

export const ctrlActive = style([
  ctrl,
  {
    color: vars.color.success,
    ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.success },
  },
]);

export const leaveBtn = style([
  ctrl,
  {
    color: '#ff6b6b',
    ':hover': { backgroundColor: 'rgba(255,107,107,0.12)', color: '#ff6b6b' },
  },
]);

export const ctrlSplit = style({
  position: 'relative',
  width: '28px',
  height: '28px',
  flexShrink: 0,
});

export const ctrlCaret = style({
  position: 'absolute',
  top: -3,
  right: -3,
  width: '14px',
  height: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${vars.color.border}`,
  borderRadius: '3px',
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textMuted,
  fontSize: '0.45rem',
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
  zIndex: 1,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
});

export const ctrlCaretOpen = style([
  ctrlCaret,
  { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
]);

export const deviceDropdown = style({
  backgroundColor: vars.color.bgPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  zIndex: 1000,
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
});

export const deviceRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minWidth: 0,
});

export const deviceLabel = style({
  fontSize: '0.78rem',
  color: vars.color.textMuted,
  whiteSpace: 'nowrap',
  minWidth: '70px',
  flexShrink: 0,
});

export const deviceSelect = style({
  flex: 1,
  minWidth: 0,
  padding: '5px 8px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontSize: '0.82rem',
  outline: 'none',
  cursor: 'pointer',
  ':focus': { borderColor: vars.color.accent },
});

export const deviceHint = style({
  fontSize: '0.75rem',
  color: vars.color.textMuted,
  flex: 1,
});
