import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const overlay = style({
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  zIndex: 8500,
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: '16px',
  width: '280px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: vars.color.success,
  fontWeight: 600,
});

export const callerRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
});

export const callerName = style({
  fontWeight: 600,
  fontSize: '1rem',
  color: vars.color.textPrimary,
});

export const callerNote = style({
  fontSize: '0.82rem',
  color: vars.color.textMuted,
});

export const actions = style({
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
});

const btn = style({
  padding: '8px 20px',
  borderRadius: vars.radius.sm,
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
});

export const btnAccept = style([btn, { backgroundColor: vars.color.success, color: '#fff' }]);
export const btnDecline = style([btn, { backgroundColor: vars.color.danger, color: '#fff' }]);

export const iconRotated = style({
  transform: 'rotate(135deg)',
});
