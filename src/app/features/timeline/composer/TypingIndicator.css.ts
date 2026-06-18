import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

const dotBounce = keyframes({
  '0%, 80%, 100%': { opacity: 0.3, transform: 'translateY(0)' },
  '40%': { opacity: 1, transform: 'translateY(-3px)' },
});

export const typingIndicator = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 4px 0',
  fontSize: '0.8rem',
  color: vars.color.textMuted,
  height: '28px',
  flexShrink: 0,
  overflow: 'hidden',
});

export const avatars = style({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
});

export const stackedAvatar = style({
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  marginRight: '-6px',
  selectors: {
    '&:last-child': { marginRight: 0 },
  },
});

export const text = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flexShrink: 1,
  minWidth: 0,
});

export const dotRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  flexShrink: 0,
});

export const dot = style({
  width: '4px',
  height: '4px',
  borderRadius: '50%',
  backgroundColor: vars.color.textMuted,
  display: 'inline-block',
  animationName: dotBounce,
  animationDuration: '1.4s',
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
  selectors: {
    '&:nth-child(2)': { animationDelay: '0.2s' },
    '&:nth-child(3)': { animationDelay: '0.4s' },
  },
});
