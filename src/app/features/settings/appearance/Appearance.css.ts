import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const pickerBtn = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  padding: '10px',
  borderRadius: vars.radius.md,
  border: `2px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgTertiary,
  cursor: 'pointer',
  transition: 'border-color 0.15s',
  ':hover': { borderColor: vars.color.accent },
});

export const pickerLabel = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
});

export const tpWindow = style({
  width: '150px',
  height: '100px',
  borderRadius: '6px',
  display: 'flex',
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
  flexShrink: 0,
});

export const tpSidebar = style({
  width: '44px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '8px 6px',
});

export const tpSbItem = style({
  height: '6px',
  borderRadius: '3px',
  opacity: 0.45,
});

export const tpSbItemActive = style([tpSbItem, { opacity: 1 }]);

export const tpChat = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: '7px 7px 5px',
  gap: '5px',
});

export const tpMessages = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
});

export const tpMsg = style({
  display: 'flex',
  alignItems: 'flex-end',
  gap: '4px',
});

export const tpMsgMine = style([tpMsg, { justifyContent: 'flex-end' }]);

export const tpAvatar = style({
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  flexShrink: 0,
});

export const tpBubble = style({
  borderRadius: '8px 8px 8px 2px',
  padding: '4px 6px',
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  maxWidth: '90px',
});

export const tpBubbleMine = style([tpBubble, { borderRadius: '8px 8px 2px 8px' }]);

export const tpLine = style({
  height: '3px',
  borderRadius: '2px',
  opacity: 0.7,
});

export const tpInputBar = style({
  height: '14px',
  borderRadius: '4px',
  flexShrink: 0,
});

export const lpWindow = style({
  width: '150px',
  height: '100px',
  backgroundColor: vars.color.bgPrimary,
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  padding: '10px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  overflow: 'hidden',
  flexShrink: 0,
});

export const lpWindowModern = style([lpWindow, { gap: '4px' }]);

// Classic layout — message with avatar left, mine right
export const lpMsg = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '6px',
});

export const lpMsgMine = style([lpMsg, { justifyContent: 'flex-end' }]);

export const lpAvatar = style({
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  flexShrink: 0,
});

export const lpAvatarAlt = style([lpAvatar, { backgroundColor: '#43b581' }]);

export const lpBubble = style({
  backgroundColor: vars.color.bgSecondary,
  borderRadius: '10px 10px 10px 2px',
  padding: '5px 7px',
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  maxWidth: '80px',
});

export const lpBubbleMine = style([
  lpBubble,
  {
    backgroundColor: vars.color.accent,
    borderRadius: '10px 10px 2px 10px',
  },
]);

export const lpName = style({
  width: '36px',
  height: '4px',
  borderRadius: '2px',
  backgroundColor: vars.color.accent,
  opacity: 0.6,
});

export const lpLine = style({
  height: '4px',
  borderRadius: '2px',
  backgroundColor: vars.color.textMuted,
  opacity: 0.5,
});

// Modern layout rows
export const lpRow = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '6px',
  padding: '2px 0',
});

export const lpBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  flex: 1,
});

export const lpAvatarHidden = style([lpAvatar, { visibility: 'hidden' }]);
