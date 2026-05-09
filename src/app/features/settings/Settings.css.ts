import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  zIndex: 7000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const dialog = style({
  backgroundColor: vars.color.bgPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  width: '80vw',
  height: '80vh',
  maxWidth: '900px',
  maxHeight: '720px',
  display: 'flex',
  overflow: 'hidden',
  '@media': {
    '(max-width: 700px)': {
      width: '100vw',
      height: '100vh',
      borderRadius: '0',
      maxWidth: '100vw',
      maxHeight: '100vh',
    },
  },
});

export const nav = style({
  width: '220px',
  backgroundColor: vars.color.bgSecondary,
  borderRight: `1px solid ${vars.color.border}`,
  display: 'flex',
  flexDirection: 'column',
  padding: '12px 8px',
  gap: '2px',
  overflowY: 'auto',
  flexShrink: 0,
  '@media': {
    '(max-width: 700px)': { width: '56px' },
  },
});

export const navLabel = style({
  padding: '8px 10px',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: vars.color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
});

export const navItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '9px 12px',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
  fontWeight: 500,
  transition: 'background-color 0.15s, color 0.15s',
  textAlign: 'left',
  width: '100%',
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.textPrimary,
  },
});

export const navItemActive = style([
  navItem,
  {
    backgroundColor: vars.color.bgActive,
    color: vars.color.textPrimary,
  },
]);

export const navDivider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '6px 8px',
});

export const content = style({
  flex: 1,
  overflowY: 'auto',
  padding: '32px 40px',
  position: 'relative',
  color: vars.color.textPrimary,
  '@media': {
    '(max-width: 700px)': { padding: '16px' },
  },
});

export const closeBtn = style({
  position: 'absolute',
  top: '16px',
  right: '20px',
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: `1px solid ${vars.color.border}`,
  background: vars.color.bgTertiary,
  color: vars.color.textMuted,
  fontSize: '1rem',
  transition: 'background-color 0.15s, color 0.15s',
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.textPrimary,
  },
});

export const panelTitle = style({
  fontSize: '1.4rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
  marginBottom: '24px',
});

export const section = style({
  marginBottom: '24px',
});

export const sectionTitle = style({
  fontSize: '1rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
  marginBottom: '12px',
});

export const settingItem = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: `1px solid ${vars.color.border}`,
  gap: '16px',
});

export const settingItemInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const settingLabel = style({
  fontSize: '0.9rem',
  color: vars.color.textPrimary,
  fontWeight: 500,
});

export const settingNote = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
});

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

export const actionBtn = style({
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

export const actionBtnDanger = style([actionBtn, { backgroundColor: vars.color.danger }]);

export const divider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '16px 0',
});

export const tokenField = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  padding: '8px 12px',
  fontSize: '0.85rem',
  fontFamily: 'monospace',
  wordBreak: 'break-all',
  flex: 1,
});

export const versionText = style({
  color: vars.color.textMuted,
  fontSize: '0.9rem',
});

export const externalLink = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: vars.color.accent,
  textDecoration: 'none',
  fontSize: '0.9rem',
  fontWeight: 500,
  transition: 'color 0.15s',
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
