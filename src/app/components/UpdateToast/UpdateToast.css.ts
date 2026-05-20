import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

const slideIn = keyframes({
  from: { transform: 'translateX(-50%) translateY(16px)', opacity: 0 },
  to: { transform: 'translateX(-50%) translateY(0)', opacity: 1 },
});

export const toast = style({
  position: 'fixed',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 8500,
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
  fontSize: '0.88rem',
  fontWeight: 500,
  color: vars.color.textPrimary,
  animationName: slideIn,
  animationDuration: '0.25s',
  animationTimingFunction: 'ease-out',
  whiteSpace: 'nowrap',
});

export const icon = style({
  color: vars.color.accent,
  flexShrink: 0,
});

export const actions = style({
  display: 'flex',
  gap: '8px',
  marginLeft: '4px',
});

export const btnPrimary = style({
  padding: '4px 12px',
  borderRadius: vars.radius.sm,
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.82rem',
  fontWeight: 600,
  backgroundColor: vars.color.accent,
  color: '#fff',
  ':hover': {
    opacity: 0.88,
  },
});

export const btnSecondary = style({
  padding: '4px 10px',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  cursor: 'pointer',
  fontSize: '0.82rem',
  fontWeight: 500,
  backgroundColor: 'transparent',
  color: vars.color.textSecondary,
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});
