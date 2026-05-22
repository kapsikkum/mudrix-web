import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '12px',
  padding: '8px 0',
});

export const icon = style({
  color: vars.color.accent,
});

export const text = style({
  fontSize: '0.9rem',
  color: vars.color.textSecondary,
  lineHeight: '1.55',
  margin: 0,
});

export const footerButtons = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '8px',
  width: '100%',
});
