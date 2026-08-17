import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const roomListPanel = style({
  width: '234px',
  backgroundColor: vars.color.bgSecondary,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  borderRight: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const roomHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 12px 8px',
  fontWeight: 600,
  fontSize: '0.95rem',
  color: vars.color.textMuted,
  letterSpacing: '0.04em',
  borderBottom: `1px solid ${vars.color.border}`,
});

export const roomHeaderTitle = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

export const roomHeaderIcon = style({
  flexShrink: 0,
  opacity: 0.7,
});

export const roomHeaderLabel = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
});

export const roomHeaderActions = style({
  display: 'flex',
  gap: '4px',
});

export const roomList = style({
  flex: 1,
  overflowY: 'auto',
  padding: '4px 0',
  position: 'relative',
});

export const emptyList = style({
  padding: '16px',
  color: vars.color.textMuted,
  fontSize: '0.85rem',
  textAlign: 'center',
});

export const spaceInviteBanner = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  padding: '24px 16px',
  textAlign: 'center',
  flex: 1,
});

export const spaceInviteName = style({
  fontSize: '1rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const spaceInviteBy = style({
  fontSize: '0.82rem',
  color: vars.color.textMuted,
});

export const spaceInviteActions = style({
  display: 'flex',
  gap: '8px',
  marginTop: '4px',
});

const skeletonPulseKeyframes = keyframes({
  '0%': { opacity: 0.6 },
  '50%': { opacity: 1 },
  '100%': { opacity: 0.6 },
});

const skeletonPulse = style({
  animation: `${skeletonPulseKeyframes} 1.4s ease-in-out infinite`,
});

export const skeletonList = style({
  padding: '4px 8px',
});

export const skeletonRow = style([
  skeletonPulse,
  {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 4px',
  },
]);

export const skeletonAvatar = style({
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  backgroundColor: vars.color.bgTertiary,
  flexShrink: 0,
});

export const skeletonLines = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

export const skeletonLine = style({
  height: '8px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
  width: '100%',
});

export const skeletonLineShort = style({
  height: '8px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
  width: '60%',
});

export const subspaceCategoryHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '2px 8px 2px 4px',
  marginTop: '4px',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  userSelect: 'none',
  width: '100%',
  background: 'none',
  border: 'none',
  color: vars.color.textMuted,
  fontSize: '0.78rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
  transition: `background-color ${fast}, color ${fast}`,
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgHover,
      color: vars.color.textPrimary,
    },
  },
});

export const subspaceChevron = style({
  flexShrink: 0,
  transition: 'transform 0.15s ease',
  opacity: 0.7,
});

export const subspaceChevronClosed = style({
  transform: 'rotate(-90deg)',
});

export const subspaceName = style({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'left',
});

export const subspaceSpacer = style({
  flex: 1,
});

export const subspaceUnreadDot = style({
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  flexShrink: 0,
});
