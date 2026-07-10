import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
});

export const scrollArea = style({
  flexShrink: 0,
  overflowY: 'auto',
  padding: '24px 32px 0',
});

export const roomListSection = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  padding: '0 32px 24px',
});

export const roomListScroll = style({
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
  position: 'relative',
});

export const spaceHeader = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '12px',
  marginBottom: '32px',
  padding: '16px 0',
});

export const spaceInfo = style({
  textAlign: 'center',
  maxWidth: '100%',
});

export const spaceName = style({
  fontSize: '1.25rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
});

export const spaceTopic = style({
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  marginTop: '4px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
});

export const spaceActions = style({
  display: 'flex',
  gap: '8px',
  flexShrink: 0,
  alignItems: 'center',
});

export const sectionTitle = style({
  display: 'none',
});
export const sectionTitleToggle = style({ display: 'none' });
export const sectionTitleActions = style({ display: 'none' });

export const roomRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '5px 8px',
  borderRadius: vars.radius.sm,
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgHover,
    },
  },
});

export const roomRowDivider = style({
  width: '1px',
  height: '20px',
  backgroundColor: vars.color.border,
  flexShrink: 0,
  marginLeft: '4px',
});

export const roomRowActions = style({
  display: 'flex',
  gap: '4px',
  flexShrink: 0,
  alignItems: 'center',
});

export const roomInfo = style({
  flex: 1,
  minWidth: 0,
});

export const roomName = style({
  fontSize: '0.88rem',
  fontWeight: 500,
  color: vars.color.textPrimary,
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  overflow: 'hidden',
});

export const roomMeta = style({
  fontSize: '0.76rem',
  color: vars.color.textMuted,
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  overflow: 'hidden',
  marginTop: '1px',
});

export const metaDivider = style({
  width: '2px',
  height: '2px',
  borderRadius: '50%',
  backgroundColor: vars.color.textMuted,
  flexShrink: 0,
  opacity: 0.5,
});

export const roomTopicText = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
});

export const memberCount = style({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  flexShrink: 0,
});

export const emptyState = style({
  padding: '32px 16px',
  textAlign: 'center',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
});

export const sortBtnWrap = style({
  position: 'relative',
  width: '28px',
  height: '28px',
  flexShrink: 0,
  borderRadius: vars.radius.sm,
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});

export const sortBtnIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  border: `1px solid transparent`,
  color: vars.color.textMuted,
  pointerEvents: 'none',
});

export const sortSelect = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  border: 'none',
  appearance: 'none',
});

const skeletonPulseKeyframes = keyframes({
  '0%': { opacity: 0.6 },
  '50%': { opacity: 1 },
  '100%': { opacity: 0.6 },
});

const skeletonPulse = style({
  animation: `${skeletonPulseKeyframes} 1.4s ease-in-out infinite`,
});

export const skeletonHeader = style([
  skeletonPulse,
  {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '32px',
    padding: '16px 0',
  },
]);

export const skeletonAvatarCircle = style({
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  backgroundColor: vars.color.bgTertiary,
});

export const skeletonLine = style({
  height: '14px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
});

export const skeletonLineWide = style([skeletonLine, { width: '180px' }]);
export const skeletonLineShort = style([skeletonLine, { width: '120px' }]);

export const skeletonActions = style({
  display: 'flex',
  gap: '8px',
  marginTop: '4px',
});

export const skeletonButton = style({
  width: '80px',
  height: '30px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
});

export const skeletonSectionRow = style([
  skeletonPulse,
  {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: vars.color.bgPrimary,
    borderRadius: vars.radius.md,
    border: `1px solid ${vars.color.border}`,
    marginBottom: '4px',
  },
]);

export const skeletonSectionLine = style({
  height: '12px',
  width: '120px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
  flex: 1,
});

export const skeletonSectionBtn = style({
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  backgroundColor: vars.color.bgTertiary,
  flexShrink: 0,
});

export const skeletonRoomRow = style([
  skeletonPulse,
  {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 8px',
    borderRadius: vars.radius.sm,
  },
]);

export const skeletonRoomAvatar = style({
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  backgroundColor: vars.color.bgTertiary,
  flexShrink: 0,
});

export const skeletonRoomInfo = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
});

export const skeletonRoomName = style({
  height: '10px',
  width: '140px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
});

export const skeletonRoomMeta = style({
  height: '8px',
  width: '80px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
});

export const spaceSection = style({
  marginBottom: '16px',
});

export const spaceSectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  borderRadius: vars.radius.md,
  cursor: 'pointer',
  userSelect: 'none',
  width: '100%',
  background: vars.color.bgPrimary,
  border: `1px solid ${vars.color.border}`,
  color: vars.color.textPrimary,
  marginBottom: '4px',
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgHover,
    },
  },
});

export const spaceSectionChevron = style({
  flexShrink: 0,
  color: vars.color.textMuted,
  transition: 'transform 0.15s ease',
});

export const spaceSectionChevronClosed = style({
  transform: 'rotate(-90deg)',
});

export const spaceSectionTitle = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  textAlign: 'left',
});

export const spaceSectionName = style({
  fontSize: '0.92rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const spaceSectionMeta = style({
  fontSize: '0.75rem',
  color: vars.color.textMuted,
  marginTop: '1px',
});

export const spaceSectionActions = style({
  display: 'flex',
  gap: '4px',
  flexShrink: 0,
  alignItems: 'center',
});

export const spaceSectionRooms = style({
  paddingLeft: '4px',
  paddingBottom: '4px',
});

export const spaceSectionRoomItem = style({
  boxSizing: 'border-box',
});

export const subSpaceCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '5px 8px',
  borderRadius: vars.radius.sm,
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgHover,
    },
  },
});

export const subSpaceCardInfo = style({
  flex: 1,
  minWidth: 0,
});

export const subSpaceCardName = style({
  fontSize: '0.88rem',
  fontWeight: 500,
  color: vars.color.textPrimary,
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const subSpaceCardMeta = style({
  fontSize: '0.75rem',
  color: vars.color.textMuted,
  marginTop: '1px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const suggestedBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 6px',
  borderRadius: '999px',
  backgroundColor: vars.color.success,
  color: '#fff',
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.03em',
  flexShrink: 0,
  userSelect: 'none',
});
