import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

const iconBtn = style({
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
  transition: `background-color ${fast}, color ${fast}`,
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.textPrimary,
  },
});

export const mobileHeader = style({
  display: 'none',
  '@media': {
    '(max-width: 768px)': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      height: '48px',
      backgroundColor: vars.color.bgSecondary,
      borderBottom: `1px solid ${vars.color.border}`,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    },
  },
});

export const mobileMenuBtn = style([
  iconBtn,
  {
    width: '36px',
    height: '36px',
    fontSize: '1rem',
  },
]);

export const spacer = style({
  width: '36px',
});

export const mobileHeaderTitle = style({
  fontWeight: 600,
  fontSize: '0.95rem',
  flex: 1,
  textAlign: 'center',
});
