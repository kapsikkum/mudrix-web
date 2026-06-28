import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(-8px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  zIndex: 8000,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '10vh',
});

export const dialog = style({
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  width: '100%',
  maxWidth: '600px',
  maxHeight: '70vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  animation: `${fadeIn} ${fast} ease`,
});

export const searchBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '14px 16px',
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
  '::placeholder': {
    color: vars.color.textMuted,
  },
});

export const hintText = style({
  fontSize: '0.75rem',
  color: vars.color.textMuted,
  flexShrink: 0,
  whiteSpace: 'nowrap',
});

export const results = style({
  overflowY: 'auto',
  flex: 1,
});

export const resultItem = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '10px 16px',
  cursor: 'pointer',
  borderBottom: `1px solid ${vars.color.border}`,
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});

export const resultMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const resultRoom = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: vars.color.accent,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const resultSender = style({
  fontSize: '0.75rem',
  color: vars.color.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const resultTime = style({
  fontSize: '0.72rem',
  color: vars.color.textMuted,
  marginLeft: 'auto',
  flexShrink: 0,
});

export const resultBody = style({
  fontSize: '0.875rem',
  color: vars.color.textSecondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const highlight = style({
  color: vars.color.textPrimary,
  fontWeight: 600,
  backgroundColor: `rgba(${vars.color.accentRgb}, 0.2)`,
  borderRadius: '2px',
  padding: '0 1px',
});

export const statusMessage = style({
  padding: '24px 16px',
  textAlign: 'center',
  fontSize: '0.875rem',
  color: vars.color.textMuted,
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
