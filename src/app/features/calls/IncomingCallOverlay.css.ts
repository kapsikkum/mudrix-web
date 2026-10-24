import { globalStyle, keyframes, style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

const ringPulse = keyframes({
  '0%': { transform: 'scale(1)', opacity: 0.55 },
  '100%': { transform: 'scale(1.45)', opacity: 0 },
});

export const overlay = style({
  position: 'fixed',
  // Centred until it is dragged somewhere; the dragged spot is set inline.
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  cursor: 'grab',
  touchAction: 'none',
  userSelect: 'none',
  zIndex: 8500,
  width: '300px',
  padding: '28px 20px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '20px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
  '@media': {
    // On a phone the ring takes the whole screen, like the OS call screen.
    '(max-width: 768px)': {
      inset: 0,
      transform: 'none',
      cursor: 'auto',
      width: 'auto',
      justifyContent: 'center',
      gap: '32px',
      padding: '32px 16px',
      border: 'none',
      borderRadius: 0,
      boxShadow: 'none',
    },
  },
});

export const ringIdentity = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
  maxWidth: '100%',
  textAlign: 'center',
});

export const ringAvatar = style({
  position: 'relative',
  width: '96px',
  height: '96px',
  marginBottom: '10px',
  flexShrink: 0,
  borderRadius: '50%',
  '::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: `3px solid ${vars.color.success}`,
    animationName: ringPulse,
    animationDuration: '1.6s',
    animationTimingFunction: 'ease-out',
    animationIterationCount: 'infinite',
  },
  '@media': {
    '(max-width: 768px)': {
      width: '128px',
      height: '128px',
    },
    '(prefers-reduced-motion: reduce)': {
      '::before': { animationName: 'none', opacity: 0.6 },
    },
  },
});

globalStyle(`${ringAvatar} > *`, {
  borderRadius: '50%',
});

export const ringName = style({
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '1.2rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
});

export const ringNote = style({
  fontSize: '0.9rem',
  color: vars.color.textMuted,
});

export const actions = style({
  display: 'flex',
  justifyContent: 'center',
  gap: '40px',
});

export const action = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: vars.color.textMuted,
});

const roundButton = style({
  width: '56px',
  height: '56px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: '#fff',
  transition: 'filter 120ms ease, transform 120ms ease',
  selectors: {
    '&:hover': { filter: 'brightness(1.1)' },
    '&:active': { transform: 'scale(0.95)' },
    '&:focus-visible': { outline: `2px solid ${vars.color.textPrimary}`, outlineOffset: '2px' },
  },
});

export const btnAccept = style([roundButton, { backgroundColor: vars.color.success }]);
export const btnDecline = style([roundButton, { backgroundColor: vars.color.danger }]);

export const iconRotated = style({
  transform: 'rotate(135deg)',
});
