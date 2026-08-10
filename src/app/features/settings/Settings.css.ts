import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export * from '@/app/components/Settings/Settings.css';

export const navDivider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '6px 8px',
});

export const navItemWithBadge = style({
  position: 'relative',
});

export const navItemBadge = style({
  position: 'absolute',
  right: '8px',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  flexShrink: 0,
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

export const audioRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '10px 0',
  borderBottom: `1px solid ${vars.color.border}`,
  '@media': {
    '(max-width: 600px)': {
      flexDirection: 'column',
      gap: '8px',
    },
  },
});

export const audioDeviceWrap = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flex: 1,
  minWidth: 0,
  '@media': {
    '(max-width: 600px)': {
      flex: 'none',
      width: '100%',
    },
  },
});

export const audioVolumeWrap = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flex: 1,
  minWidth: 0,
  '@media': {
    '(max-width: 600px)': {
      flex: 'none',
      width: '100%',
    },
  },
});

export const audioControl = style({
  flex: 1,
  minWidth: 0,
});

export const audioDeviceLabel = style({
  minWidth: '90px',
  flexShrink: 0,
});

export const audioDeviceSelect = style({
  width: '200px',
  flexShrink: 0,
  '@media': {
    '(max-width: 600px)': {
      flex: 1,
      minWidth: 0,
    },
  },
});

export const cameraPreview = style({
  position: 'relative',
  width: '100%',
  maxWidth: '320px',
  aspectRatio: '16 / 9',
  borderRadius: '8px',
  overflow: 'hidden',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: '8px',
});

export const cameraPreviewVideo = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const cameraPreviewPlaceholder = style({
  fontSize: '0.82rem',
  color: vars.color.textMuted,
  textAlign: 'center',
  padding: '0 16px',
  userSelect: 'none',
});

export const statusText = style({
  fontSize: '0.85rem',
  flexShrink: 0,
});

export const hintText = style({
  marginTop: '12px',
  fontSize: '0.82rem',
  maxWidth: '380px',
  lineHeight: '1.5',
  color: vars.color.textMuted,
});

export const keyBackupActions = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxWidth: '320px',
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

export const settingRowDisabled = style({
  cursor: 'not-allowed',
});

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
