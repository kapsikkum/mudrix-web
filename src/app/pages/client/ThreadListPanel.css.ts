import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const threadFilterBar = style({
  display: 'flex',
  gap: '4px',
  padding: '8px 12px',
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
  alignItems: 'center',
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

export const threadItemBodyUndecryptable = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontStyle: 'italic',
  color: vars.color.textMuted,
  fontSize: '0.85rem',
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
