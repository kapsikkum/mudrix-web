import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

const pulseAnim = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.3 },
});

export const bar = style({
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  zIndex: 8500,
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: '12px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
  minWidth: '220px',
});

export const callIndicator = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  color: vars.color.success,
  flexShrink: 0,
});

export const pulse = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: vars.color.success,
  animationName: pulseAnim,
  animationDuration: '1.5s',
  animationIterationCount: 'infinite',
});

export const info = style({
  flex: 1,
  minWidth: 0,
});

export const callerName = style({
  fontSize: '0.88rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const callStatus = style({
  fontSize: '0.75rem',
  color: vars.color.textMuted,
  marginTop: '1px',
});

export const controls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexShrink: 0,
});

const controlBtn = style({
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 0.15s, opacity 0.15s',
  flexShrink: 0,
});

export const muteBtn = style([
  controlBtn,
  {
    backgroundColor: vars.color.bgHover,
    color: vars.color.textPrimary,
    ':hover': {
      backgroundColor: vars.color.border,
    },
  },
]);

export const muteBtnActive = style([
  controlBtn,
  {
    backgroundColor: 'rgba(250,166,26,0.2)',
    color: '#faA61a',
    ':hover': {
      backgroundColor: 'rgba(250,166,26,0.3)',
    },
  },
]);

export const hangupBtn = style([
  controlBtn,
  {
    backgroundColor: vars.color.danger,
    color: '#fff',
    ':hover': {
      opacity: 0.85,
    },
  },
]);
