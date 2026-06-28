import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const menu = style({
  position: 'fixed',
  zIndex: 9999,
  minWidth: '180px',
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  padding: '4px 0',
  userSelect: 'none',
});

export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 14px',
  fontSize: '0.88rem',
  color: vars.color.textPrimary,
  cursor: 'pointer',
  transition: `background-color ${fast}`,
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});

export const menuItemDanger = style([
  menuItem,
  {
    color: vars.color.error,
    ':hover': {
      backgroundColor: 'rgba(255, 107, 107, 0.12)',
    },
  },
]);

export const menuItemIcon = style({
  width: '14px',
  height: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.75,
  flexShrink: 0,
});

export const menuDivider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '4px 0',
});
