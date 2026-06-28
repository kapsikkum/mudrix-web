import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

const base = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.body,
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  transition: `background-color ${fast}, color ${fast}, opacity ${fast}`,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

export const sizes = styleVariants({
  sm: [base, { padding: '5px 12px', fontSize: '0.82rem' }],
  md: [base, { padding: '8px 18px', fontSize: '0.9rem' }],
  lg: [base, { padding: '11px 20px', fontSize: '0.95rem', width: '100%' }],
});

const variantBase = (extra: object) =>
  styleVariants({
    sm: [sizes.sm, extra],
    md: [sizes.md, extra],
    lg: [sizes.lg, extra],
  });

export const primary = variantBase({
  backgroundColor: vars.color.accent,
  color: '#fff',
  ':hover': { backgroundColor: vars.color.accentHover },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

export const secondary = variantBase({
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textPrimary,
  ':hover': { backgroundColor: vars.color.bgHover },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

export const danger = variantBase({
  backgroundColor: vars.color.danger,
  color: '#fff',
  ':hover': { opacity: 0.85 },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

export const success = variantBase({
  backgroundColor: vars.color.success,
  color: '#fff',
  ':hover': { opacity: 0.85 },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

export const ghost = variantBase({
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

export const fullWidth = style({ width: '100%' });

const iconBase = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: vars.radius.sm,
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
  transition: `background-color ${fast}, color ${fast}`,
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

export const iconSizes = styleVariants({
  xs: [iconBase, { width: '22px', height: '22px', fontSize: '0.75rem' }],
  sm: [iconBase, { width: '28px', height: '28px', fontSize: '0.9rem' }],
  md: [iconBase, { width: '32px', height: '32px', fontSize: '1rem' }],
  lg: [iconBase, { width: '36px', height: '36px', fontSize: '1rem' }],
});

export const iconDefault = style({
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
});

export const iconActive = style({
  backgroundColor: vars.color.bgActive,
  color: vars.color.accent,
  ':hover': { backgroundColor: vars.color.bgActive, color: vars.color.accent },
});

export const iconDanger = style({
  backgroundColor: 'transparent',
  color: vars.color.danger,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.danger },
});

export const iconBordered = style({
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textMuted,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
});
