import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const list = style({
  padding: '8px 0',
});

export const row = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  fontSize: '0.9rem',
  color: vars.color.textPrimary,
});

export const kbd = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: '0.78rem',
  fontWeight: 500,
  color: vars.color.textSecondary,
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: '4px',
  padding: '2px 6px',
  lineHeight: 1.4,
});
