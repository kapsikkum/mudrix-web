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
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '12vh',
});

export const dialog = style({
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  width: '100%',
  maxWidth: '520px',
  maxHeight: '60vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  animation: `${fadeIn} ${fast} ease`,
});

export const searchBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '12px 16px',
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const searchIcon = style({
  color: vars.color.accent,
  flexShrink: 0,
});

export const searchInput = style({
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: '1rem',
  color: vars.color.textPrimary,
  '::placeholder': { color: vars.color.textMuted },
});

export const results = style({
  flex: 1,
  overflowY: 'auto',
  padding: '4px 0',
});

export const sectionHeader = style({
  fontSize: '0.7rem',
  fontWeight: 700,
  color: vars.color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '8px 16px 4px',
});

export const resultItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 16px',
  cursor: 'pointer',
  userSelect: 'none',
  selectors: {
    '&:hover, &[data-highlighted="true"]': {
      backgroundColor: vars.color.bgHover,
    },
  },
});

export const resultName = style({
  flex: 1,
  fontSize: '0.9rem',
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const resultBadge = style({
  flexShrink: 0,
  backgroundColor: vars.color.accent,
  color: '#fff',
  borderRadius: '10px',
  fontSize: '0.72rem',
  fontWeight: 700,
  padding: '1px 6px',
  minWidth: '18px',
  textAlign: 'center',
});

export const resultBadgeNotif = style([resultBadge, { backgroundColor: vars.color.error }]);

export const dmIcon = style({
  color: vars.color.textMuted,
  flexShrink: 0,
  display: 'flex',
});

export const emptyState = style({
  padding: '24px 16px',
  textAlign: 'center',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
});

export const footer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '8px 16px',
  borderTop: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const footerHint = style({
  fontSize: '0.72rem',
  color: vars.color.textMuted,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const kbd = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1px 5px',
  borderRadius: '3px',
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgTertiary,
  fontSize: '0.7rem',
  fontFamily: 'monospace',
  color: vars.color.textSecondary,
});
