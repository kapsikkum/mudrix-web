import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export * from '@/app/components/Settings/Settings.css';

export const navDivider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '6px 8px',
});

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

export const settingRowColumn = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '8px',
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
