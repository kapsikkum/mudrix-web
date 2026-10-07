import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const bar = style({
  position: 'absolute',
  left: '50%',
  bottom: '12px',
  transform: 'translateX(-50%)',
  zIndex: 75,
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: '6px',
  borderRadius: '999px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  maxWidth: 'calc(100% - 24px)',
  pointerEvents: 'auto',
  userSelect: 'none',
});

export const group = style({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
});

export const divider = style({
  width: '1px',
  height: '24px',
  margin: '0 4px',
  backgroundColor: vars.color.border,
  flexShrink: 0,
});

const button = style({
  width: '40px',
  height: '40px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  borderRadius: '999px',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  transition: `background-color ${fast}, color ${fast}, filter ${fast}`,
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgHover,
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: '1px',
    },
  },
});

export const ctrl = button;

export const ctrlActive = style([button, { color: vars.color.success }]);

export const ctrlAccent = style([button, { color: vars.color.accent }]);

export const ctrlDanger = style([button, { color: '#ff6b6b' }]);

export const deafenIcon = style({
  position: 'relative',
  display: 'inline-flex',
});

export const deafenIconSlash = style({
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: '26px',
  height: '2px',
  transform: 'translate(-50%, -50%) rotate(45deg)',
  pointerEvents: 'none',
});

export const deafenIconOutline = style({
  position: 'absolute',
  top: 0,
  left: '1px',
  right: '1px',
  height: '1px',
  borderRadius: '1px',
  background: vars.color.bgSecondary,
});

export const deafenIconCore = style({
  position: 'absolute',
  bottom: 0,
  left: '1px',
  right: '1px',
  height: '1px',
  borderRadius: '1px',
  background: 'currentColor',
});

export const menuAnchor = style({
  display: 'inline-flex',
});

export const menu = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '8px 10px',
  border: 'none',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  color: vars.color.textPrimary,
  fontSize: '0.88rem',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
  transition: `background-color ${fast}`,
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgHover,
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: '-2px',
    },
  },
});

export const menuItemActive = style([
  menuItem,
  {
    color: vars.color.accent,
  },
]);

export const menuItemLabel = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const menuItemCheck = style({
  flexShrink: 0,
  color: vars.color.accent,
});

export const menuItemSpacer = style({
  width: '16px',
  flexShrink: 0,
});
