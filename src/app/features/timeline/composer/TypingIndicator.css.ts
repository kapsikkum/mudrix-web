import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

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
