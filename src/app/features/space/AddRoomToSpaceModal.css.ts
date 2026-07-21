import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

export const searchWrapper = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
});

export const searchIcon = style({
  position: 'absolute',
  left: '10px',
  color: vars.color.textMuted,
  pointerEvents: 'none',
});

export const searchInput = style({
  width: '100%',
  padding: '8px 10px 8px 30px',
  fontSize: '0.88rem',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgSecondary,
  color: vars.color.textPrimary,
  outline: 'none',
  selectors: {
    '&:focus': {
      borderColor: vars.color.accent,
    },
  },
  '::placeholder': {
    color: vars.color.textMuted,
  },
});

export const roomList = style({
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '360px',
  overflowY: 'auto',
  gap: '2px',
});

export const roomItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 10px',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  transition: 'background-color 0.1s',
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgTertiary,
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: '-2px',
    },
  },
});

export const roomItemLoading = style({
  opacity: 0.5,
  pointerEvents: 'none',
});

export const roomItemName = style({
  flex: 1,
  fontSize: '0.88rem',
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const empty = style({
  textAlign: 'center',
  color: vars.color.textMuted,
  fontSize: '0.88rem',
  padding: '24px 0',
});
