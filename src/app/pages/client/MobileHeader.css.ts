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
      // The bar extends under the status bar / notch; its content sits below the inset.
      padding: 'var(--safe-top) calc(12px + var(--safe-right)) 0 calc(12px + var(--safe-left))',
      height: 'calc(48px + var(--safe-top))',
      boxSizing: 'border-box',
      flexShrink: 0,
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

export const mobileSearch = style({
  flex: 1,
  minWidth: 0,
  marginLeft: '8px',
});

export const mobileActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const mobileActionBtn = style([
  iconBtn,
  {
    width: '32px',
    height: '32px',
  },
]);

export const mobileActionBtnActive = style([
  mobileActionBtn,
  {
    color: vars.color.accent,
    selectors: {
      '&&:hover': {
        backgroundColor: vars.color.bgHover,
        color: vars.color.accent,
      },
    },
  },
]);

export const mobileThreadIconWrap = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const mobileThreadDot = style({
  position: 'absolute',
  bottom: '-1px',
  right: '-1px',
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  boxShadow: `0 0 0 2px ${vars.color.bgSecondary}`,
  pointerEvents: 'none',
});

export const mobileHeaderTitle = style({
  fontWeight: 600,
  fontSize: '0.95rem',
  textAlign: 'center',
  position: 'absolute',
  left: 0,
  right: 0,
  top: 'var(--safe-top)',
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
});
