import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const sectionLabel = style({
  fontSize: '0.8rem',
  fontWeight: 700,
  color: vars.color.textMuted,
  letterSpacing: '0.06em',
});

export const kindHint = style({
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  lineHeight: '1.4',
  marginTop: '6px',
});

export const kindSelect = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  position: 'relative',
  padding: '8px 12px',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgInput,
  cursor: 'pointer',
});

export const kindSelectIcon = style({
  display: 'flex',
  alignItems: 'center',
  color: vars.color.accent,
  flexShrink: 0,
});

export const kindSelectLabel = style({
  flex: 1,
  fontSize: '0.9rem',
  color: vars.color.textPrimary,
});

export const kindSelectChevron = style({
  display: 'flex',
  alignItems: 'center',
  color: vars.color.textMuted,
  flexShrink: 0,
});

export const kindSelectNative = style({
  position: 'absolute',
  inset: 0,
  opacity: 0,
  cursor: 'pointer',
  fontSize: '1rem',
});

export const optionsList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const optionRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const optionInput = style({
  flex: 1,
  padding: '8px 12px',
  backgroundColor: vars.color.bgInput,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  color: vars.color.textPrimary,
  fontSize: '0.95rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  ':focus': {
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px color-mix(in srgb, ${vars.color.accent} 18%, transparent)`,
  },
  '::placeholder': { color: vars.color.textMuted },
});

export const removeOptionBtn = style({
  flexShrink: 0,
  width: '30px',
  height: '30px',
  borderRadius: '50%',
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s, color 0.15s',
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.danger,
  },
  ':disabled': {
    opacity: 0.3,
    cursor: 'default',
  },
});

export const addOptionBtn = style({
  alignSelf: 'flex-start',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: vars.radius.md,
  border: `1px dashed ${vars.color.border}`,
  background: 'none',
  color: vars.color.textMuted,
  fontSize: '0.88rem',
  cursor: 'pointer',
  transition: 'border-color 0.15s, color 0.15s, background-color 0.15s',
  ':hover': {
    borderColor: vars.color.accent,
    color: vars.color.accent,
    backgroundColor: `color-mix(in srgb, ${vars.color.accent} 8%, transparent)`,
  },
  ':disabled': {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
});
