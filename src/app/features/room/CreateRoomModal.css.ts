import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const accessSelect = style({
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

export const accessSelectIcon = style({
  display: 'flex',
  alignItems: 'center',
  color: vars.color.accent,
  flexShrink: 0,
});

export const accessSelectLabel = style({
  flex: 1,
  fontSize: '0.9rem',
  color: vars.color.textPrimary,
});

export const accessSelectChevron = style({
  display: 'flex',
  alignItems: 'center',
  color: vars.color.textMuted,
  flexShrink: 0,
});

export const accessSelectNative = style({
  position: 'absolute',
  inset: 0,
  opacity: 0,
  cursor: 'pointer',
  fontSize: '1rem',
});

export const sectionLabel = style({
  fontSize: '0.8rem',
  fontWeight: 700,
  color: vars.color.textMuted,
  letterSpacing: '0.06em',
});
