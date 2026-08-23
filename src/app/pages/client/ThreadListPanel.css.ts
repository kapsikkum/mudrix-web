import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { med, slideInRight } from '@/theme/animations.css';

const base = {
  width: '320px',
  backgroundColor: vars.color.bgSecondary,
  borderLeft: `1px solid ${vars.color.border}`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  flexShrink: 0,
  '@media': {
    '(max-width: 768px)': {
      position: 'fixed',
      right: 'env(safe-area-inset-right)',
      top: 'env(safe-area-inset-top)',
      bottom: 'env(safe-area-inset-bottom)',
      zIndex: 5000,
      transform: 'translateX(100%)',
      transition: `transform ${med} ease`,
    },
  },
} as const;

export const threadListPanel = style(base);

export const threadListPanelOpen = style({
  ...base,
  '@media': {
    '(max-width: 768px)': {
      position: 'fixed',
      right: 'env(safe-area-inset-right)',
      top: 'env(safe-area-inset-top)',
      bottom: 'env(safe-area-inset-bottom)',
      zIndex: 5000,
      transform: 'translateX(0)',
      animation: `${slideInRight} ${med} ease`,
    },
  },
});

export const threadListHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px',
  fontSize: '1rem',
  fontWeight: 700,
  color: vars.color.textMuted,
  letterSpacing: '0.04em',
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const threadListTitle = style({
  fontSize: 'inherit',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const threadListClose = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  borderRadius: vars.radius.sm,
  border: 'none',
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  cursor: 'pointer',
  flexShrink: 0,
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.textPrimary,
  },
});

export const threadFilterBar = style({
  display: 'flex',
  gap: '4px',
  padding: '8px 12px',
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
  alignItems: 'center',
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

export const toolbarIconBtn = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  border: 'none',
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  cursor: 'pointer',
  flexShrink: 0,
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.textPrimary,
  },
  ':disabled': {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
});

export const threadListBody = style({
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
});

export const threadListEmpty = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 16px',
  color: vars.color.textMuted,
  fontSize: '0.85rem',
  fontStyle: 'italic',
  flex: 1,
});

export const threadListItem = style({
  display: 'flex',
  gap: '10px',
  padding: '8px 12px',
  cursor: 'pointer',
  borderBottom: `1px solid ${vars.color.border}`,
  transition: 'background-color 0.15s ease',
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});

export const threadItemAvatar = style({
  flexShrink: 0,
  marginTop: '2px',
});

export const threadItemContent = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const threadItemMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

export const threadItemSender = style({
  fontSize: '0.82rem',
  fontWeight: 600,
  color: vars.color.accent,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const threadItemTime = style({
  fontSize: '0.72rem',
  color: vars.color.textMuted,
  flexShrink: 0,
  whiteSpace: 'nowrap',
});

export const threadItemBody = style({
  fontSize: '0.85rem',
  color: vars.color.textPrimary,
  lineHeight: '1.4',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  wordBreak: 'break-word',
});

export const threadItemFooter = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginTop: '2px',
});

export const threadItemReplyCount = style({
  fontSize: '0.74rem',
  color: vars.color.textMuted,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const threadItemUnreadDot = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  flexShrink: 0,
});
