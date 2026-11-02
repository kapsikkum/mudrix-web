import { keyframes, style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const button = style({
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  flexShrink: 0,
  backgroundColor: 'transparent',
  color: vars.color.accent,
  transition: `background-color ${fast}, color ${fast}`,
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
  selectors: {
    '&:disabled': { cursor: 'progress', opacity: 0.7 },
  },
});

const spin = keyframes({ to: { transform: 'rotate(360deg)' } });

export const spinning = style({ animation: `${spin} 0.9s linear infinite` });
