import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const memberRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '5px 12px',
  borderRadius: vars.radius.sm,
  margin: '0 4px',
  cursor: 'default',
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});

export const memberName = style({
  fontSize: '0.88rem',
  color: vars.color.textMuted,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const emptyState = style({
  padding: '16px',
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  textAlign: 'center',
});
