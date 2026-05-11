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
});

export const accessLabel = style({
  fontSize: '0.85rem',
  fontWeight: 600,
  color: vars.color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const settingRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: `1px solid ${vars.color.border}`,
  gap: '16px',
  cursor: 'pointer',
});

export const radioCircle = style({
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  border: `2px solid ${vars.color.border}`,
  backgroundColor: 'transparent',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s, border-color 0.15s',
  marginTop: '2px',
});

export const radioCircleSelected = style({
  borderColor: vars.color.accent,
  backgroundColor: vars.color.accent,
});

export const radioCircleDot = style({
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  backgroundColor: '#fff',
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
