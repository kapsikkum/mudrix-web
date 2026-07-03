import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(-8px) scale(0.97)' },
  to: { opacity: 1, transform: 'translateY(0) scale(1)' },
});

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  zIndex: 9500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const dialog = style({
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  width: '100%',
  maxWidth: '420px',
  overflow: 'hidden',
  animation: `${fadeIn} ${fast} ease`,
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: `1px solid ${vars.color.border}`,
});

export const title = style({
  fontSize: '1rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const closeBtn = style({
  background: 'none',
  border: 'none',
  color: vars.color.textMuted,
  cursor: 'pointer',
  padding: '4px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ':hover': { color: vars.color.textPrimary, backgroundColor: vars.color.bgHover },
});

export const list = style({
  padding: '8px 0',
});

export const row = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  fontSize: '0.9rem',
  color: vars.color.textPrimary,
});

export const kbd = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: '0.78rem',
  fontWeight: 500,
  color: vars.color.textSecondary,
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: '4px',
  padding: '2px 6px',
  lineHeight: 1.4,
});
