import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fadeInUp, med, fast } from '@/theme/animations.css';

export const wrapper = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px',
  overflow: 'auto',
  backgroundColor: vars.color.bgPrimary,
});

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '20px',
  maxWidth: '440px',
  width: '100%',
  padding: '32px 28px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  animation: `${fadeInUp} ${med} ease-out`,
});

export const roomName = style({
  fontSize: '1.4rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
  margin: 0,
  wordBreak: 'break-word',
});

export const memberCount = style({
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  margin: 0,
});

export const topic = style({
  fontSize: '0.9rem',
  color: vars.color.textSecondary,
  lineHeight: 1.5,
  margin: 0,
  maxHeight: '6em',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 4,
  WebkitBoxOrient: 'vertical',
  wordBreak: 'break-word',
});

export const inviter = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  padding: '8px 12px',
  backgroundColor: vars.color.bgTertiary,
  borderRadius: vars.radius.md,
});

export const actions = style({
  display: 'flex',
  gap: '10px',
  width: '100%',
  marginTop: '4px',
});

const btnBase = style({
  flex: 1,
  padding: '10px 16px',
  borderRadius: vars.radius.md,
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  transition: `filter ${fast}, opacity ${fast}, color ${fast}, background-color ${fast}`,
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
  ':hover': { filter: 'brightness(1.12)' },
});

export const acceptBtn = style([
  btnBase,
  {
    backgroundColor: vars.color.success,
    color: '#fff',
  },
]);

export const declineBtn = style([
  btnBase,
  {
    backgroundColor: vars.color.bgTertiary,
    color: vars.color.textMuted,
    selectors: {
      '&:hover:not(:disabled)': { color: vars.color.error, filter: 'none' },
    },
  },
]);
