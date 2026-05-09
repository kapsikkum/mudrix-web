import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

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
  textTransform: 'uppercase',
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
  transition: 'background-color 0.15s, color 0.15s',
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
