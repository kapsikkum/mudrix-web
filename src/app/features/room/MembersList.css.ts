import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const membersListContainer = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
});

export const membersScrollArea = style({
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
});

export const memberRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '5px 12px',
  borderRadius: vars.radius.sm,
  margin: '0 4px',
  cursor: 'default',
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});

export const memberName = style({
  fontSize: '0.88rem',
  color: vars.color.textMuted,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const emptyState = style({
  padding: '16px',
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  textAlign: 'center',
});

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 8px',
});

export const searchWrapper = style({
  position: 'relative',
  flex: 1,
  display: 'flex',
  alignItems: 'center',
});

export const searchIcon = style({
  position: 'absolute',
  left: '7px',
  color: vars.color.textMuted,
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
});

export const searchInput = style({
  width: '100%',
  padding: '5px 8px 5px 26px',
  backgroundColor: vars.color.bgInput,
  color: vars.color.textPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontSize: '0.82rem',
  fontFamily: vars.font.body,
  outline: 'none',
  boxSizing: 'border-box',
  '::placeholder': { color: vars.color.textMuted },
  ':focus': { borderColor: vars.color.accent },
});

export const toolbarBtn = style({
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

export const toolbarBtnActive = style([
  toolbarBtn,
  {
    color: vars.color.accent,
    backgroundColor: vars.color.bgHover,
    borderColor: vars.color.accent,
  },
]);

export const selectBtnWrap = style({
  position: 'relative',
  width: '28px',
  height: '28px',
  flexShrink: 0,
  borderRadius: vars.radius.sm,
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});

export const select = style({
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

export const skeletonList = style({
  padding: '0 12px',
});

export const skeletonRow = style([
  skeletonPulse,
  {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 0',
  },
]);

export const skeletonAvatar = style({
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  backgroundColor: vars.color.bgTertiary,
  flexShrink: 0,
});

export const skeletonLine = style({
  height: '12px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
  flex: 1,
  maxWidth: '140px',
});

export const roleHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '0 12px',
  userSelect: 'none',
});

export const roleHeaderLabel = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: vars.color.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const roleHeaderCount = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: vars.color.textMuted,
  opacity: 0.7,
  flexShrink: 0,
});
