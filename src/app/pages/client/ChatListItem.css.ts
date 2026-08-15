import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const roomItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  cursor: 'pointer',
  borderRadius: vars.radius.sm,
  margin: '0 4px',
  transition: `background-color ${fast}`,
  fontSize: '0.95rem',
  color: vars.color.textMuted,
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.textPrimary,
  },
});

export const roomItemActive = style([
  roomItem,
  {
    backgroundColor: vars.color.bgActive,
    color: vars.color.textPrimary,
  },
]);

export const chatAvatarImg = style({
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  objectFit: 'cover',
});

export const chatTextContent = style({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const chatAvatar = style({
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  overflow: 'hidden',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.85rem',
  position: 'relative',
});

export const avatarWrap = style({
  position: 'relative',
  width: '32px',
  height: '32px',
  flexShrink: 0,
});

export const roomTypeBadge = style({
  position: 'absolute',
  right: '-4px',
  bottom: '-4px',
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  backgroundColor: vars.color.bgPrimary,
  color: vars.color.textMuted,
  border: `1px solid ${vars.color.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1,
  pointerEvents: 'none',
});

export const roomTypeBadgeVoice = style([
  roomTypeBadge,
  {
    color: vars.color.success,
    borderColor: vars.color.success,
  },
]);

export const inviteBadge = style({
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export const callBadge = style({
  color: vars.color.success,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

const bump = keyframes({
  '0%': { transform: 'scale(1)' },
  '40%': { transform: 'scale(1.2)' },
  '100%': { transform: 'scale(1)' },
});

export const badgeBump = style({
  animationName: bump,
  animationDuration: '150ms',
  animationTimingFunction: 'ease-out',
});

export const roomBadge = style({
  marginLeft: 'auto',
  backgroundColor: vars.color.accent,
  color: '#fff',
  borderRadius: '10px',
  fontSize: '0.72rem',
  fontWeight: 700,
  padding: '1px 6px',
  minWidth: '18px',
  textAlign: 'center',
});

export const roomBadgeNotif = style([roomBadge, { backgroundColor: vars.color.error }]);
