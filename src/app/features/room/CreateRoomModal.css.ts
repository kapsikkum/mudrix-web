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
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: '24px',
  maxWidth: '460px',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  maxHeight: '90vh',
  overflowY: 'auto',
});

export const header = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  alignItems: 'center',
  textAlign: 'center',
});

export const icon = style({
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.2rem',
  marginBottom: '8px',
});

export const title = style({
  fontSize: '1.2rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
});

export const subtitle = style({
  fontSize: '0.85rem',
  color: vars.color.textMuted,
});

export const label = style({
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  marginBottom: '4px',
  display: 'block',
});

export const inputCss = style({
  width: '100%',
  padding: '9px 12px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontSize: '0.9rem',
  outline: 'none',
  '::placeholder': { color: vars.color.textMuted },
  ':focus': { borderColor: vars.color.accent },
});

export const toggleRow = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '10px 0',
  borderBottom: `1px solid ${vars.color.border}`,
});

export const toggleInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const toggleLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontWeight: 500,
  color: vars.color.textPrimary,
  fontSize: '0.9rem',
});

export const toggleNote = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
});

export const toggleSwitch = style({
  position: 'relative',
  display: 'inline-flex',
  cursor: 'pointer',
});

export const actions = style({
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
});

const btn = style({
  padding: '9px 20px',
  borderRadius: vars.radius.sm,
  fontSize: '0.9rem',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
});

export const btnPrimary = style([btn, { backgroundColor: vars.color.accent, color: '#fff' }]);
export const btnSecondary = style([
  btn,
  {
    backgroundColor: vars.color.bgTertiary,
    color: vars.color.textPrimary,
  },
]);

export const accessSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const accessLabel = style({
  fontSize: '0.85rem',
  fontWeight: 600,
  color: vars.color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const accessOption = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '12px',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  cursor: 'pointer',
  transition: 'border-color 0.15s, background-color 0.15s',
  backgroundColor: vars.color.bgPrimary,
  ':hover': {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.bgHover,
  },
});

export const accessOptionSelected = style([
  accessOption,
  {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.bgActive,
  },
]);

export const accessRadio = style({
  marginTop: '2px',
  accentColor: vars.color.accent,
  flexShrink: 0,
  width: '16px',
  height: '16px',
  cursor: 'pointer',
});

export const accessOptionInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const accessOptionTitle = style({
  fontSize: '0.9rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const accessOptionDesc = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
  lineHeight: '1.4',
});
