import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const dialogBody = style({
  selectors: {
    '&&': {
      padding: 0,
      gap: 0,
      overflow: 'hidden',
      flexDirection: 'row',
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
    '(max-width: 768px)': { width: '56px' },
  },
});

export const navLabel = style({
  padding: '8px 10px',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: vars.color.textMuted,
  letterSpacing: '0.06em',
  '@media': {
    '(max-width: 768px)': {
      display: 'none',
    },
  },
});

export const navLabelText = style({
  '@media': {
    '(max-width: 768px)': {
      display: 'none',
    },
  },
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
  transition: `background-color ${fast}, color ${fast}`,
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
    '(max-width: 768px)': { padding: '16px' },
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
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  fontSize: '1rem',
  transition: `background-color ${fast}, color ${fast}`,
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

export const divider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '16px 0',
  selectors: {
    '& + &': { display: 'none' },
  },
});

export const avatarRow = style({
  display: 'flex',
  alignItems: 'flex-start',
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
  transition: `opacity ${fast}`,
  ':hover': { opacity: 1 },
});

export const badgeRow = style({
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '6px',
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

export const iconBefore = style({
  marginRight: '6px',
});

export const fieldGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
});

export const avatarUploadWrap = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
});

export const avatarPreviewImg = style({
  width: '72px',
  height: '72px',
  borderRadius: '50%',
  objectFit: 'cover',
});

export const hiddenInput = style({
  display: 'none',
});

export const whiteIcon = style({
  color: '#fff',
});

export const settingRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: `1px solid ${vars.color.border}`,
  gap: '16px',
});

export const settingRowClickable = style({
  cursor: 'pointer',
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

export const actions = style({
  display: 'flex',
  gap: '8px',
  marginTop: '8px',
});

export const flexRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const flexRowWrap = style({
  display: 'flex',
  alignItems: 'flex-end',
  gap: '12px',
  width: '100%',
});

export const flexOne = style({
  flex: 1,
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
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgSecondary,
  padding: '8px',
});

export const noResults = style({
  padding: '16px',
  textAlign: 'center',
  color: vars.color.textMuted,
  fontSize: '0.85rem',
});

export const permGroupHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 10px 6px',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: vars.color.textMuted,

  letterSpacing: '0.04em',
  borderTop: `1px solid ${vars.color.border}`,
  marginTop: '4px',
  ':first-child': {
    borderTop: 'none',
    marginTop: 0,
  },
});

export const permGroupBadge = style({
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '1px 7px',
  borderRadius: '10px',
  backgroundColor: vars.color.bgHover,
  color: vars.color.textMuted,
});

export const permShowMore = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  fontSize: '0.82rem',
  color: vars.color.accent,
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  width: '100%',
  textAlign: 'left',
  borderRadius: vars.radius.sm,
  ':hover': { backgroundColor: vars.color.bgHover },
});

export const permRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 10px',
  borderRadius: vars.radius.sm,
  transition: `background-color ${fast}`,
  ':hover': { backgroundColor: vars.color.bgHover },
});

export const permRowName = style({
  flex: 1,
  minWidth: 0,
  fontSize: '0.88rem',
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const permRowId = style({
  fontSize: '0.72rem',
  color: vars.color.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '140px',
  display: 'none',
  '@media': {
    '(min-width: 768px)': { display: 'block' },
  },
});
