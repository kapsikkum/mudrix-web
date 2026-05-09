import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

const slideDown = keyframes({
  from: { opacity: 0, transform: 'translateY(-8px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

export const bar = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  backgroundColor: vars.color.bgSecondary,
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
  animationName: slideDown,
  animationDuration: '0.2s',
  animationTimingFunction: 'ease-out',
});

export const roomAvatar = style({
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  flexShrink: 0,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1rem',
  fontWeight: 700,
  color: '#fff',
  userSelect: 'none',
});

export const info = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const roomName = style({
  fontSize: '0.95rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const invitedBy = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.8rem',
  color: vars.color.textMuted,
});

export const inviterAvatar = style({
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  flexShrink: 0,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.5rem',
  fontWeight: 700,
  color: '#fff',
});

export const inviterName = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '220px',
});

export const actions = style({
  display: 'flex',
  gap: '8px',
  flexShrink: 0,
});

const btnBase = style({
  padding: '6px 16px',
  borderRadius: vars.radius.md,
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  transition: 'filter 0.15s, opacity 0.15s, color 0.15s',
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
  ':hover': { filter: 'brightness(1.12)' },
});

export const acceptBtn = style([
  btnBase,
  {
    backgroundColor: vars.color.success,
    color: '#fff',
  },
]);

export const declineBtn = style([
  btnBase,
  {
    backgroundColor: vars.color.bgTertiary,
    color: vars.color.textMuted,
    ':hover': { color: vars.color.error, filter: 'none' },
  },
]);
