import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const notice = style({
  position: 'absolute',
  left: '50%',
  bottom: '72px',
  transform: 'translateX(-50%)',
  zIndex: 75,
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '4px 4px 4px 12px',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  color: vars.color.textPrimary,
  fontSize: '0.85rem',
  maxWidth: 'calc(100% - 24px)',
  pointerEvents: 'auto',
  userSelect: 'none',
});

export const dot = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: vars.color.danger,
  flexShrink: 0,
});

export const label = style({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const stopButton = style({
  flexShrink: 0,
  padding: '5px 10px',
  border: 'none',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.danger,
  color: '#fff',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: `filter ${fast}`,
  selectors: {
    '&:hover': { filter: 'brightness(1.1)' },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: '1px',
    },
  },
});
