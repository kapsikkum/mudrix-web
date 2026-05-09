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
  width: '200px',
  backgroundColor: vars.color.bgSecondary,
  borderRight: `1px solid ${vars.color.border}`,
  display: 'flex',
  flexDirection: 'column',
  padding: '12px 8px',
  gap: '2px',
  overflowY: 'auto',
  flexShrink: 0,
  '@media': {
    '(max-width: 700px)': { width: '52px' },
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
  marginBottom: '28px',
});

export const sectionTitle = style({
  fontSize: '1rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
  marginBottom: '12px',
});

export const divider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '20px 0',
});

export const avatarRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  marginBottom: '4px',
});

export const avatarClickable = style({
  cursor: 'pointer',
  position: 'relative',
  borderRadius: '50%',
  flexShrink: 0,
});

export const avatarOverlay = style({
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0,
  transition: 'opacity 0.15s',
  ':hover': { opacity: 1 },
});

export const avatarHint = style({
  color: vars.color.textMuted,
  fontSize: '0.85rem',
});

export const avatarReadOnly = style({
  position: 'relative',
  borderRadius: '50%',
  flexShrink: 0,
});

export const fieldGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
});

export const settingRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: `1px solid ${vars.color.border}`,
  gap: '16px',
});

export const settingInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const settingLabel = style({
  fontSize: '0.9rem',
  fontWeight: 500,
  color: vars.color.textPrimary,
});

export const settingNote = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
});

export const select = style({
  padding: '8px 12px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontSize: '0.9rem',
  outline: 'none',
  cursor: 'pointer',
  ':focus': { borderColor: vars.color.accent },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

export const tokenRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const tokenField = style({
  flex: 1,
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  padding: '8px 12px',
  fontSize: '0.82rem',
  fontFamily: 'monospace',
  wordBreak: 'break-all',
  color: vars.color.textMuted,
});

export const badge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '0.78rem',
  color: vars.color.textMuted,
  backgroundColor: vars.color.bgHover,
  borderRadius: vars.radius.sm,
  padding: '3px 8px',
});

export const permSearchRow = style({
  display: 'flex',
  gap: '8px',
  alignItems: 'flex-end',
  marginBottom: '12px',
});

export const permSearchWrap = style({
  flex: 1,
});

export const permResults = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  maxHeight: '260px',
  overflowY: 'auto',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
  padding: '4px',
});

export const permResultItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 10px',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  transition: 'background-color 0.1s',
  ':hover': { backgroundColor: vars.color.bgHover },
});

export const permResultItemSelected = style([
  permResultItem,
  {
    backgroundColor: vars.color.bgActive,
  },
]);

export const permResultName = style({
  flex: 1,
  fontSize: '0.9rem',
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const permResultId = style({
  fontSize: '0.75rem',
  color: vars.color.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '160px',
});

export const permLevelBadge = style({
  fontSize: '0.72rem',
  fontWeight: 600,
  padding: '2px 7px',
  borderRadius: '10px',
  flexShrink: 0,
});

export const permLevelAdmin = style([
  permLevelBadge,
  { backgroundColor: 'rgba(88,101,242,0.18)', color: vars.color.accent },
]);

export const permLevelMod = style([
  permLevelBadge,
  { backgroundColor: 'rgba(59,165,93,0.18)', color: vars.color.success },
]);

export const permLevelMember = style([
  permLevelBadge,
  { backgroundColor: vars.color.bgHover, color: vars.color.textMuted },
]);

export const permApplyRow = style({
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  marginTop: '12px',
  padding: '12px',
  backgroundColor: vars.color.bgSecondary,
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
});

export const permApplyLabel = style({
  flex: 1,
  fontSize: '0.88rem',
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const noResults = style({
  padding: '16px',
  textAlign: 'center',
  color: vars.color.textMuted,
  fontSize: '0.85rem',
});

export const actions = style({
  display: 'flex',
  gap: '8px',
  marginTop: '8px',
});

export const readOnlyNote = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
  fontStyle: 'italic',
  marginBottom: '16px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

export const radioGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const radioItem = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '12px',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  border: `1px solid transparent`,
  transition: 'background-color 0.15s',
  ':hover': { backgroundColor: vars.color.bgHover },
  selectors: {
    '&:has(input:checked)': {
      backgroundColor: vars.color.bgActive,
      borderColor: vars.color.border,
    },
  },
});

export const radioContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const radioLabel = style({
  fontSize: '0.9rem',
  fontWeight: 500,
  color: vars.color.textPrimary,
});
