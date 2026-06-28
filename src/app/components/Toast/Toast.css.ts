import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { slideInRight, med, fast } from '@/theme/animations.css';

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
  animation: `${slideInRight} ${med} ease-out`,
  pointerEvents: 'all',
  maxWidth: '360px',
});

export const toastInfo = style([toast, { backgroundColor: vars.color.accent }]);
export const toastSuccess = style([toast, { backgroundColor: vars.color.success }]);
export const toastError = style([toast, { backgroundColor: vars.color.error }]);
export const toastWarning = style([toast, { backgroundColor: '#e8a838' }]);

export const clickable = style({
  cursor: 'pointer',
  transition: `filter ${fast}`,
  border: 'none',
  textAlign: 'left',
  font: 'inherit',
  selectors: {
    '&:hover': { filter: 'brightness(1.1)' },
    '&:focus-visible': { outline: '2px solid rgba(255,255,255,0.6)', outlineOffset: '2px' },
  },
});

export const message = style({
  flex: 1,
  minWidth: 0,
});

export const action = style({
  fontWeight: 600,
  fontSize: '0.82rem',
  whiteSpace: 'nowrap',
  padding: '4px 10px',
  borderRadius: vars.radius.sm,
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  color: '#fff',
  transition: `background-color ${fast}`,
  selectors: {
    [`${clickable}:hover &`]: { backgroundColor: 'rgba(255, 255, 255, 0.32)' },
  },
});
