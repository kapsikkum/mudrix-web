import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const roomItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  cursor: 'pointer',
  borderRadius: vars.radius.sm,
  margin: '0 4px',
  transition: 'background-color 0.15s',
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

export const roomItemInvite = style([
  roomItem,
  {
    color: vars.color.accent,
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

export const inviteBadge = style({
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  flexShrink: 0,
});

export const micBtn = style({
  width: '22px',
  height: '22px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  color: vars.color.textMuted,
  flexShrink: 0,
  opacity: 0,
  transition: 'opacity 0.15s, color 0.15s, background-color 0.15s',
  selectors: {
    [`${roomItem}:hover &, ${roomItemActive} &`]: {
      opacity: 1,
    },
  },
  ':hover': { color: vars.color.accent },
});

export const micBtnActive = style([
  micBtn,
  {
    opacity: 1,
    color: vars.color.success,
    ':hover': { color: '#ff6b6b' },
  },
]);

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
