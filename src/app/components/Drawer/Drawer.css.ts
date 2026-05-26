import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

const slideIn = keyframes({
  from: { transform: 'translateX(100%)' },
  to: { transform: 'translateX(0)' },
});

const slideOut = keyframes({
  from: { transform: 'translateX(0)' },
  to: { transform: 'translateX(100%)' },
});

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const fadeOut = keyframes({
  from: { opacity: 1 },
  to: { opacity: 0 },
});

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  zIndex: 6000,
  animation: `${fadeIn} 200ms ease`,
});

export const overlayClosing = style({
  animation: `${fadeOut} 150ms ease`,
  opacity: 0,
});

export const drawer = style({
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '340px',
  maxWidth: '90vw',
  backgroundColor: vars.color.bgSecondary,
  borderLeft: `1px solid ${vars.color.border}`,
  zIndex: 6001,
  display: 'flex',
  flexDirection: 'column',
  animation: `${slideIn} 200ms ease`,
  boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
});

export const drawerClosing = style({
  animation: `${slideOut} 150ms ease`,
  transform: 'translateX(100%)',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const title = style({
  fontSize: '1.1rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const body = style({
  padding: '20px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  overflowY: 'auto',
  flex: 1,
});
