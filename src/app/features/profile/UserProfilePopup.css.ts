import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { scaleIn, fast } from '@/theme/animations.css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 7000,
});

export const popup = style({
  position: 'fixed',
  zIndex: 7001,
  width: '280px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  animation: `${scaleIn} ${fast} ease`,
  display: 'flex',
  flexDirection: 'column',
  padding: '20px',
  gap: '14px',
});

export const topRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
});

export const avatarWrap = style({
  cursor: 'pointer',
  borderRadius: '50%',
  lineHeight: 0,
  flexShrink: 0,
});

export const nameSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
});

export const displayName = style({
  fontSize: '1.05rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
  wordBreak: 'break-word',
  lineHeight: 1.3,
});

export const userIdRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const userId = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
  fontFamily: 'monospace',
  wordBreak: 'break-all',
  lineHeight: 1.3,
});

export const infoRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.85rem',
});

export const infoIcon = style({
  display: 'flex',
  alignItems: 'center',
  color: vars.color.textMuted,
  flexShrink: 0,
});

export const infoValue = style({
  color: vars.color.textPrimary,
  fontWeight: 500,
  marginRight: 'auto',
});

export const roleBadge = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '2px 10px',
  borderRadius: vars.radius.sm,
  textTransform: 'capitalize',
  flexShrink: 0,
});

export const roleAdmin = style([
  roleBadge,
  { backgroundColor: 'rgba(220, 38, 38, 0.15)', color: '#ef4444' },
]);

export const roleModerator = style([
  roleBadge,
  { backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308' },
]);

export const roleMember = style([
  roleBadge,
  { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
]);

export const roleSelect = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '2px 10px',
  borderRadius: vars.radius.sm,
  textTransform: 'capitalize',
  flexShrink: 0,
});

export const roleSelectWrap = style({
  position: 'relative',
  display: 'inline-flex',
});

export const roleSelectHidden = style({
  position: 'absolute',
  inset: 0,
  opacity: 0,
  cursor: 'pointer',
  width: '100%',
});

export const modActions = style({
  display: 'flex',
  gap: '8px',
});

export const modActionBtn = style({
  flex: 1,
});
