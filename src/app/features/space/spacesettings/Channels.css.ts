import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const toolbar = style({ display: 'flex', gap: '8px', margin: '12px 0' });

export const category = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginTop: '16px',
});

export const categoryName = style({
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: vars.color.textSecondary,
  margin: '0 0 4px',
});

export const row = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '4px 8px',
  padding: '6px 8px',
  borderRadius: '6px',
  background: vars.color.bgTertiary,
  color: vars.color.textPrimary,
});

export const rowName = style({
  flex: '1 1 140px',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
