import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const textarea = style({
  width: '100%',
  minHeight: '80px',
  padding: '10px 12px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontSize: '0.9rem',
  fontFamily: 'monospace',
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
  ':focus': { borderColor: vars.color.accent },
});

export const infoBox = style({
  backgroundColor: 'rgba(99,102,241,0.08)',
  border: `1px solid rgba(99,102,241,0.25)`,
  borderRadius: vars.radius.sm,
  padding: '10px 14px',
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  lineHeight: '1.55',
  display: 'flex',
  gap: '8px',
  alignItems: 'flex-start',
});

export const hint = style({
  fontSize: '0.82rem',
  color: vars.color.textMuted,
  lineHeight: '1.5',
});

export const infoIcon = style({
  marginTop: '2px',
  flexShrink: 0,
});

export const flexEnd = style({
  marginRight: 'auto',
});

export const iconMargin = style({
  marginRight: '6px',
});
