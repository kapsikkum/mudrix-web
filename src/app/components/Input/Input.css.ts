import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

const inputBase = style({
  width: '100%',
  padding: '9px 12px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontSize: '0.9rem',
  fontFamily: vars.font.body,
  outline: 'none',
  transition: `border-color ${fast}`,
  '::placeholder': { color: vars.color.textMuted },
  ':focus': { borderColor: vars.color.accent },
  ':disabled': { opacity: 0.6, cursor: 'not-allowed' },
});

export const input = inputBase;

export const textarea = style([
  inputBase,
  {
    resize: 'vertical',
    lineHeight: '1.5',
    minHeight: '80px',
  },
]);

export const label = style({
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: vars.color.textMuted,
  letterSpacing: '0.05em',
  marginBottom: '6px',
});

export const wrap = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0px',
  width: '100%',
});

export const helperText = style({
  fontSize: '0.78rem',
  color: vars.color.textMuted,
  marginTop: '4px',
});

export const errorText = style({
  fontSize: '0.78rem',
  color: vars.color.danger,
  marginTop: '4px',
});
