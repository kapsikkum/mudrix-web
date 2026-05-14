import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const deviceList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '4px',
});

export const deviceCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 14px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
});

export const deviceCardCurrent = style([
  deviceCard,
  {
    borderColor: vars.color.accent,
    backgroundColor: `color-mix(in srgb, ${vars.color.accent} 6%, ${vars.color.bgSecondary})`,
  },
]);

export const deviceIcon = style({
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  backgroundColor: vars.color.bgTertiary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: vars.color.textMuted,
  fontSize: '1rem',
});

export const deviceInfo = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const deviceName = style({
  fontSize: '0.9rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap',
});

export const deviceId = style({
  fontSize: '0.75rem',
  color: vars.color.textMuted,
  fontFamily: 'monospace',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const tagCurrent = style({
  fontSize: '0.7rem',
  fontWeight: 700,
  padding: '1px 6px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.accent,
  color: '#fff',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
});

export const tagVerified = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: vars.radius.sm,
  backgroundColor: 'rgba(59,165,93,0.15)',
  color: vars.color.success,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  flexShrink: 0,
});

export const tagUnverified = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: vars.radius.sm,
  backgroundColor: 'rgba(250,166,26,0.12)',
  color: '#faA61a',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  flexShrink: 0,
});

export const actions = style({
  display: 'flex',
  gap: '6px',
  flexShrink: 0,
});

const actionBtnBase = style({
  padding: '5px 12px',
  borderRadius: vars.radius.sm,
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  ':disabled': { opacity: 0.45, cursor: 'not-allowed' },
});

export const verifyBtn = style([
  actionBtnBase,
  {
    backgroundColor: vars.color.accent,
    color: '#fff',
    ':hover': { backgroundColor: vars.color.accentHover },
  },
]);

export const removeBtn = style([
  actionBtnBase,
  {
    backgroundColor: vars.color.bgTertiary,
    color: vars.color.danger,
    border: `1px solid ${vars.color.danger}`,
    ':hover': { backgroundColor: vars.color.danger, color: '#fff' },
  },
]);

export const uiaPanel = style({
  margin: '0 0 20px',
  padding: '20px',
  backgroundColor: `color-mix(in srgb, ${vars.color.accent} 5%, ${vars.color.bgSecondary})`,
  border: `1px solid ${vars.color.accent}`,
  borderRadius: vars.radius.md,
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

export const uiaPanelHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.9rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const uiaPanelDesc = style({
  fontSize: '0.82rem',
  color: vars.color.textMuted,
  lineHeight: '1.55',
});

export const uiaForm = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
});

export const uiaActions = style({
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
});

export const uiaError = style({
  fontSize: '0.8rem',
  color: vars.color.error,
});

export const uiaSso = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const uiaSsoDivider = style({
  fontSize: '0.78rem',
  color: vars.color.textMuted,
  textAlign: 'center',
});

export const uiaUnsupported = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  fontSize: '0.85rem',
  color: vars.color.textMuted,
});

export const emptyState = style({
  fontSize: '0.9rem',
  color: vars.color.textMuted,
  textAlign: 'center',
  padding: '24px 0',
});

export const sessionNote = style({
  marginBottom: '14px',
});

export const sessionActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: '16px',
});

export const spinner = style({
  display: 'flex',
  justifyContent: 'center',
  padding: '24px 0',
  color: vars.color.textMuted,
});
