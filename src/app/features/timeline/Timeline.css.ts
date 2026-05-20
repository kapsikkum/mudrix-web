import { style, keyframes, globalStyle } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const timelineContainer = style({
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  padding: '0 0 8px',
  scrollBehavior: 'smooth',
  backgroundColor: vars.color.bgPrimary,
});

export const loadingSpinnerWrap = style({
  display: 'flex',
  justifyContent: 'center',
  padding: '16px',
});

const spin = keyframes({ to: { transform: 'rotate(360deg)' } });
export const spinner = style({
  width: '24px',
  height: '24px',
  border: `2px solid ${vars.color.border}`,
  borderTopColor: vars.color.accent,
  borderRadius: '50%',
  animationName: spin,
  animationDuration: '0.8s',
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
});

export const dateSeparator = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '12px 16px 4px',
  fontSize: '0.78rem',
  color: vars.color.textMuted,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  '::before': { content: '""', flex: 1, height: '1px', backgroundColor: vars.color.border },
  '::after': { content: '""', flex: 1, height: '1px', backgroundColor: vars.color.border },
});

export const msgAvatarCol = style({
  flexShrink: 0,
  width: '36px',
  display: 'flex',
  justifyContent: 'center',
  paddingTop: '2px',
});

export const msgRow = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '6px 16px 2px',
  ':hover': { backgroundColor: vars.color.bgHover },
});

// Grouped follow-up (same sender <5 min)
export const msgRowGrouped = style([msgRow, { paddingTop: '1px', paddingBottom: '1px' }]);

// Own message: flip the row so avatar + bubble are on the right
export const msgRowOwn = style([msgRow, { flexDirection: 'row-reverse' }]);
export const msgRowOwnGrouped = style([msgRowOwn, { paddingTop: '1px', paddingBottom: '1px' }]);

// Body column for classic (bubbles stack in a column, constrained width)
export const msgBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
  maxWidth: '75%',
});
export const msgBodyOwn = style([msgBody, { alignItems: 'flex-end' }]);

// Sender name + timestamp row (classic — sits above the first bubble)
export const msgMeta = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
  marginBottom: '2px',
});
export const msgSender = style({ fontWeight: 600, color: vars.color.accent, fontSize: '0.9rem' });
export const msgTime = style({ color: vars.color.textMuted, fontSize: '0.75rem' });

// Classic bubbles
export const msgBubble = style({
  backgroundColor: vars.color.msgOtherBg,
  color: vars.color.textPrimary,
  padding: '7px 12px',
  borderRadius: '12px',
  fontSize: '0.95rem',
  lineHeight: '1.55',
  wordBreak: 'break-word',
  maxWidth: '100%',
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'flex-end',
  flexWrap: 'wrap',
  gap: '0 6px',
});

export const msgBubbleOwn = style([msgBubble, { backgroundColor: vars.color.msgMineBg }]);

// No bubble backgrounds, full width, compact.
// Sender name + timestamp are INLINE on the same line as content (first msg in group).
// Grouped follow-ups have no header at all — just the content indented under the avatar column.

export const msgRowModern = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '3px 16px',
  ':hover': { backgroundColor: vars.color.bgHover },
});

export const msgRowModernGrouped = style([
  msgRowModern,
  { paddingTop: '1px', paddingBottom: '1px' },
]);

// Body column for modern: full width, no constraint
export const msgBodyModern = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  flex: 1,
  minWidth: 0,
});

// The first line of a modern message: sender + time + content all inline
export const msgMetaModern = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
  flexWrap: 'wrap',
});

// No background, no padding — just plain text
export const msgBubbleModern = style({
  backgroundColor: 'transparent',
  color: vars.color.textPrimary,
  fontSize: '0.95rem',
  lineHeight: '1.55',
  wordBreak: 'break-word',
  position: 'relative',
  display: 'inline',
});

// Grouped follow-up in modern: content only, already indented by avatar spacer
export const msgBubbleModernGrouped = style([msgBubbleModern, { display: 'block' }]);

// Hover-only timestamp in modern (shown inline next to sender name)
export const msgTimeModern = style({
  color: vars.color.textMuted,
  fontSize: '0.72rem',
  opacity: 0,
  transition: 'opacity 0.1s',
  selectors: {
    [`${msgRowModern}:hover &`]: { opacity: 1 },
    [`${msgRowModernGrouped}:hover &`]: { opacity: 1 },
  },
});

export const msgSticker = style({
  maxWidth: '128px',
  borderRadius: '8px',
});

export const msgVideo = style({
  maxWidth: '320px',
  borderRadius: '8px',
});

export const msgImage = style({
  maxWidth: '320px',
  maxHeight: '240px',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  objectFit: 'cover',
});

export const loadingText = style({
  opacity: 0.5,
  fontSize: '0.8rem',
});

export const loadingRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  opacity: 0.5,
  fontSize: '0.8rem',
});

export const fileLink = style({
  color: 'inherit',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

export const emoteMsg = style({
  color: 'inherit',
  opacity: 0.85,
});

export const msgContentWrap = style({
  position: 'relative',
});

export const actionsVisible = style({
  display: 'flex',
});

export const editedMarker = style({
  fontSize: '0.72rem',
  color: vars.color.textMuted,
  fontStyle: 'italic',
  whiteSpace: 'nowrap',
  lineHeight: '1.55',
  alignSelf: 'flex-end',
  flexShrink: 0,
});

export const editedMarkerModern = style({
  fontSize: '0.72rem',
  color: vars.color.textMuted,
  fontStyle: 'italic',
  whiteSpace: 'nowrap',
  opacity: 0,
  transition: 'opacity 0.1s',
  selectors: {
    [`${msgRowModern}:hover &`]: { opacity: 1 },
    [`${msgRowModernGrouped}:hover &`]: { opacity: 1 },
  },
});

export const redactedMsg = style({
  fontStyle: 'italic',
  color: vars.color.textMuted,
  fontSize: '0.85rem',
});

export const noticeMsg = style({
  color: vars.color.textMuted,
  fontSize: '0.85rem',
});

export const replyQuote = style({
  borderLeft: `3px solid ${vars.color.accent}`,
  paddingLeft: '8px',
  marginBottom: '4px',
  fontSize: '0.95rem',
  color: vars.color.textMuted,
  borderRadius: '2px',
});

export const reactionsBar = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  marginTop: '4px',
});

export const reactionChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: '12px',
  padding: '2px 8px',
  fontSize: '0.95rem',
  cursor: 'pointer',
  userSelect: 'none',
  fontFamily: 'inherit',
  color: vars.color.textPrimary,
  transition: 'border-color 0.15s, background-color 0.15s',
  ':hover': { borderColor: vars.color.accent, backgroundColor: vars.color.bgHover },
});

export const reactionChipOwn = style([
  reactionChip,
  {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.bgActive,
    ':hover': { backgroundColor: vars.color.bgActive, borderColor: vars.color.accentHover },
  },
]);

export const reactionQuickAdd = style([
  reactionChip,
  {
    padding: '2px 8px',
    color: vars.color.textMuted,
    opacity: 0,
    transition: 'opacity 0.15s, border-color 0.15s, background-color 0.15s',
    selectors: {
      '[data-hovered="true"] &': { opacity: 1 },
    },
  },
]);

export const reactionQuickAddIconWrap = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const reactionQuickAddPlus = style({
  position: 'absolute',
  top: '-5px',
  right: '-5px',
  fontSize: '0.55rem',
  fontWeight: 800,
  lineHeight: 1,
  color: vars.color.textPrimary,
  backgroundColor: vars.color.bgSecondary,
  borderRadius: '50%',
  width: '8px',
  height: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const msgActions = style({
  position: 'absolute',
  right: '48px',
  top: '-18px',
  gap: '2px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  padding: '2px 4px',
  zIndex: 10,
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
});

export const msgActionBtn = style({
  width: '26px',
  height: '26px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  color: vars.color.textMuted,
  fontSize: '0.8rem',
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
});

export const msgActionBtnPinned = style([
  msgActionBtn,
  {
    color: vars.color.accent,
    ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.accent },
  },
]);

const dividerFadeOut = keyframes({
  from: { opacity: 1 },
  to: { opacity: 0 },
});

export const unreadDivider = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 16px',
  fontSize: '0.78rem',
  color: vars.color.accent,
  fontWeight: 600,
  animationName: dividerFadeOut,
  animationDuration: '0.5s',
  animationDelay: '1.5s',
  animationTimingFunction: 'ease-out',
  animationFillMode: 'forwards',
  '::before': { content: '""', flex: 1, height: '1px', backgroundColor: vars.color.accent },
  '::after': { content: '""', flex: 1, height: '1px', backgroundColor: vars.color.accent },
});

export const scrollToBottomBtn = style({
  position: 'absolute',
  bottom: '80px',
  right: '20px',
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.9rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  ':hover': { backgroundColor: vars.color.accentHover },
});

export const searchBanner = style({
  padding: '4px 16px',
  fontSize: '0.8rem',
  backgroundColor: vars.color.bgAccentGlow1,
  color: vars.color.accent,
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const searchMatchActive = style({
  outline: `2px solid ${vars.color.accent}`,
  outlineOffset: '-2px',
  borderRadius: '4px',
});

export const jumpFlash = style({
  backgroundColor: vars.color.bgActive,
  transition: 'background-color 1.5s ease-out',
});

export const systemMsgRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '4px 16px',
  color: vars.color.textMuted,
  fontSize: '0.82rem',
  fontStyle: 'italic',
  userSelect: 'none',
});

export const systemMsgIcon = style({
  display: 'flex',
  alignItems: 'center',
  opacity: 0.7,
  flexShrink: 0,
});

export const systemMsgText = style({
  textAlign: 'center',
});

export const callEventRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  margin: '6px 16px',
  padding: '10px 14px',
  borderRadius: vars.radius.md,
  backgroundColor: `rgba(${vars.color.accentRgb}, 0.06)`,
  border: `1px solid rgba(${vars.color.accentRgb}, 0.18)`,
  borderLeft: `3px solid ${vars.color.success}`,
  userSelect: 'none',
  flexShrink: 0,
});

export const callEventRowMissed = style([
  callEventRow,
  {
    borderLeft: `3px solid ${vars.color.danger}`,
    backgroundColor: 'rgba(237,66,69,0.06)',
    border: `1px solid rgba(237,66,69,0.18)`,
    borderLeftColor: vars.color.danger,
  },
]);

export const callEventIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  backgroundColor: vars.color.success,
  color: '#fff',
  flexShrink: 0,
});

export const callEventIconMissed = style([
  callEventIcon,
  {
    backgroundColor: vars.color.danger,
  },
]);

export const callEventBody = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
});

export const callEventLabel = style({
  fontSize: '0.88rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const callEventMeta = style({
  fontSize: '0.76rem',
  color: vars.color.textMuted,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

export const emptyRoom = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  padding: '32px 16px',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
});

export const searchEmpty = style({
  padding: '32px 16px',
  textAlign: 'center',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
});

globalStyle('.mention-pill', {
  display: 'inline-flex',
  alignItems: 'center',
  backgroundColor: `rgba(${vars.color.accentRgb}, 0.18)`,
  color: vars.color.accent,
  borderRadius: '4px',
  padding: '0 5px',
  fontSize: '0.92em',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'default',
  userSelect: 'text',
  lineHeight: '1.5',
});

// Self-mention pill — red/orange to stand out
globalStyle('.mention-pill-self', {
  backgroundColor: 'rgba(240, 100, 40, 0.18)',
  color: '#f06428',
});

export const readReceiptRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '2px',
  marginTop: '3px',
  paddingRight: '4px',
  minHeight: '16px',
});

export const readReceiptAvatar = style({
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.55rem',
  fontWeight: 700,
  color: '#fff',
  flexShrink: 0,
  overflow: 'hidden',
  userSelect: 'none',
  border: `1px solid ${vars.color.bgPrimary}`,
  marginLeft: '-4px',
  ':first-child': { marginLeft: 0 },
  cursor: 'default',
});

export const readReceiptAvatarImg = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: 'inherit',
});

export const readReceiptOverflow = style({
  fontSize: '0.6rem',
  color: vars.color.textMuted,
  marginLeft: '3px',
  whiteSpace: 'nowrap',
  userSelect: 'none',
});

export const chatDropZone = style({
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(88,101,242,0.12)',
  border: `2px dashed ${vars.color.accent}`,
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  color: vars.color.accent,
  fontSize: '1.2rem',
  fontWeight: 600,
  zIndex: 200,
  pointerEvents: 'none',
  backdropFilter: 'blur(3px)',
});
