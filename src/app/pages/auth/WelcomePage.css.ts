import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const page = style({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: vars.color.bgPrimary,
  padding: '24px',
});

export const container = style({
  width: '100%',
  maxWidth: '420px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
  backgroundColor: vars.color.bgSecondary,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  padding: '40px 32px',
});

export const logo = style({
  width: '72px',
  height: '72px',
  objectFit: 'contain',
});

export const title = style({
  fontSize: '1.5rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
  textAlign: 'center',
});

export const tagline = style({
  color: vars.color.textMuted,
  fontSize: '0.9rem',
  textAlign: 'center',
  marginBottom: '8px',
});

export const versionText = style({
  fontSize: '0.75rem',
  color: vars.color.textMuted,
  textAlign: 'center',
  marginTop: '8px',
});

export const formSection = style({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

export const formTitle = style({
  fontSize: '1.1rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const serverGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

export const select = style({
  width: '100%',
  padding: '9px 12px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontSize: '0.9rem',
  fontFamily: vars.font.body,
  outline: 'none',
  ':focus': {
    borderColor: vars.color.accent,
  },
});

export const divider = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  color: vars.color.textMuted,
  fontSize: '0.85rem',
  '::before': {
    content: '""',
    flex: 1,
    height: '1px',
    backgroundColor: vars.color.border,
  },
  '::after': {
    content: '""',
    flex: 1,
    height: '1px',
    backgroundColor: vars.color.border,
  },
});

export const idpIcon = style({
  width: '18px',
  height: '18px',
  objectFit: 'contain',
});

export const statusText = style({
  fontSize: '0.85rem',
  color: vars.color.error,
  textAlign: 'center',
  minHeight: '20px',
});

export const statusSuccess = style([statusText, { color: vars.color.success }]);

export const switchText = style({
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  textAlign: 'center',
});

export const switchLink = style({
  color: vars.color.accent,
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  padding: 0,
  font: 'inherit',
  ':hover': {
    textDecoration: 'underline',
  },
});

export const passwordReqs = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
  paddingLeft: '4px',
});

export const reqItem = style({
  lineHeight: '1.6',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});
