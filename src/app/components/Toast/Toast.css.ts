import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

const slideIn = keyframes({
  from: { transform: 'translateX(110%)', opacity: 0 },
  to: { transform: 'translateX(0)', opacity: 1 },
});

export const container = style({
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  zIndex: 8000,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  pointerEvents: 'none',
});

export const toast = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 16px',
  borderRadius: vars.radius.md,
  fontSize: '0.88rem',
  fontWeight: 500,
  color: '#fff',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  animationName: slideIn,
  animationDuration: '0.25s',
  animationTimingFunction: 'ease-out',
  pointerEvents: 'all',
  maxWidth: '360px',
});

export const toastInfo = style([toast, { backgroundColor: vars.color.accent }]);
export const toastSuccess = style([toast, { backgroundColor: vars.color.success }]);
export const toastError = style([toast, { backgroundColor: vars.color.error }]);
export const toastWarning = style([toast, { backgroundColor: '#e8a838' }]);
