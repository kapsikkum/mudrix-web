import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export * from '@/app/components/Settings/Settings.css';

export const navDivider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '6px 8px',
});

export const actionBtn = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '9px 20px',
  borderRadius: vars.radius.sm,
  fontSize: '0.9rem',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  backgroundColor: vars.color.accent,
  color: '#fff',
  ':hover': { backgroundColor: vars.color.accentHover },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

export const actionBtnSecondary = style([
  actionBtn,
  { backgroundColor: vars.color.bgTertiary, color: vars.color.textPrimary },
]);

export const inputCss = style({
  padding: '9px 12px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontSize: '0.9rem',
  outline: 'none',
  ':focus': { borderColor: vars.color.accent },
});

export const inputFull = style([inputCss, { width: '100%' }]);

export const displayNameInput = style({
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textPrimary,
});

export const settingRowColumn = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const fieldLabel = style({
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: vars.color.textMuted,
  letterSpacing: '0.05em',
  cursor: 'text',
});

export const statusText = style({
  fontSize: '0.85rem',
  flexShrink: 0,
});

export const versionText = style({
  color: vars.color.textMuted,
  fontSize: '0.9rem',
});

export const accessTokenBtn = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  border: 'none',
  background: 'none',
  color: vars.color.textPrimary,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.95rem',
});

export const tokenSection = style({
  marginTop: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
});

export const warningBox = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px',
  backgroundColor: 'rgba(248,81,73,0.1)',
  borderRadius: '6px',
  fontSize: '0.82rem',
  color: vars.color.error,
});

export const clearBtn = style({
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  cursor: 'pointer',
  fontSize: '0.9rem',
  display: 'flex',
  alignItems: 'center',
});

export const kbd = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1px 5px',
  borderRadius: '3px',
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgTertiary,
  fontSize: '0.7rem',
  fontFamily: 'monospace',
  color: vars.color.textSecondary,
});

export const keybindHint = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '6px',
  margin: '-4px 0 10px',
  fontSize: '0.8rem',
  color: vars.color.textMuted,
});

const keybindBtnBase = style({
  width: '110px',
  padding: '6px 0',
  borderRadius: vars.radius.sm,
  border: '2px solid transparent',
  backgroundColor: vars.color.bgTertiary,
  cursor: 'pointer',
  fontSize: '0.85rem',
  textAlign: 'center',
  transition: `background-color ${fast}, border-color ${fast}, color ${fast}`,
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});

export const keybindBtnSet = style([
  keybindBtnBase,
  {
    borderColor: vars.color.border,
    color: vars.color.textPrimary,
    fontWeight: 600,
    letterSpacing: '0.05em',
    ':hover': { borderColor: vars.color.textMuted },
  },
]);

export const keybindBtnEmpty = style([
  keybindBtnBase,
  {
    borderStyle: 'dashed',
    borderColor: vars.color.border,
    color: vars.color.textMuted,
    fontWeight: 400,
    letterSpacing: 'normal',
  },
]);

export const keybindBtnListening = style([
  keybindBtnBase,
  {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.bgActive,
    color: vars.color.accent,
    fontWeight: 600,
    letterSpacing: 'normal',
    ':hover': { backgroundColor: vars.color.bgActive },
  },
]);

export const externalLink = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: vars.color.accent,
  textDecoration: 'none',
  fontSize: '0.9rem',
  fontWeight: 500,
  transition: `color ${fast}`,
  ':hover': {
    color: vars.color.accentHover,
    textDecoration: 'underline',
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
    borderRadius: '2px',
  },
});

// Phone layout: a list of sections, then one section at a time with a back arrow.
export const mobileRoot = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.bgSecondary,
  overflow: 'hidden',
});

export const mobileTopBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  height: '56px',
  padding: '0 8px',
  flexShrink: 0,
  borderBottom: `1px solid ${vars.color.border}`,
  color: vars.color.textPrimary,
});

export const mobileTopTitle = style({
  flex: 1,
  minWidth: 0,
  fontSize: '1.1rem',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  padding: '0 8px',
});

export const mobileIconBtn = style({
  width: '44px',
  height: '44px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'none',
  color: vars.color.textPrimary,
  cursor: 'pointer',
  selectors: { '&:active': { backgroundColor: vars.color.bgHover } },
});

export const mobileList = style({
  flex: 1,
  overflowY: 'auto',
  padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
});

export const mobileRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  width: '100%',
  minHeight: '56px',
  padding: '0 20px',
  border: 'none',
  background: 'none',
  color: vars.color.textPrimary,
  fontSize: '1rem',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: { '&:active': { backgroundColor: vars.color.bgHover } },
});

export const mobileRowLabel = style({ flex: 1, minWidth: 0 });

export const mobileRowChevron = style({ color: vars.color.textMuted, flexShrink: 0 });

export const mobileDivider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '8px 20px',
});

export const mobileContent = style({
  flex: 1,
  overflowY: 'auto',
  padding: '16px 16px calc(24px + env(safe-area-inset-bottom))',
  color: vars.color.textPrimary,
});

// The page title is already in the top bar.
globalStyle(`${mobileContent} > div > h2:first-child, ${mobileContent} > h2:first-child`, {
  display: 'none',
});
