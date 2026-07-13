import { style, keyframes, globalStyle } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast, fadeInUp, scaleIn } from '@/theme/animations.css';

export const timelineContainer = style({
  flex: 1,
  backgroundColor: vars.color.bgPrimary,
  overflowAnchor: 'none',
});

export const loadingSpinnerWrap = style({
  display: 'flex',
  justifyContent: 'center',
  padding: '16px',
});

const shimmer = keyframes({
  '0%': { backgroundPosition: '-400px 0' },
  '100%': { backgroundPosition: '400px 0' },
});

export const skeletonRow = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '8px 16px',
  flexShrink: 0,
});

export const skeletonAvatar = style({
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  flexShrink: 0,
  backgroundImage: `linear-gradient(90deg, ${vars.color.bgTertiary} 25%, ${vars.color.bgHover} 50%, ${vars.color.bgTertiary} 75%)`,
  backgroundSize: '800px 100%',
  animationName: shimmer,
  animationDuration: '1.4s',
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
});

export const skeletonLines = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  paddingTop: '4px',
});

export const skeletonLine = style({
  height: '12px',
  borderRadius: '6px',
  backgroundImage: `linear-gradient(90deg, ${vars.color.bgTertiary} 25%, ${vars.color.bgHover} 50%, ${vars.color.bgTertiary} 75%)`,
  backgroundSize: '800px 100%',
  animationName: shimmer,
  animationDuration: '1.4s',
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
});
export const timelineStart = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  padding: '24px 16px 8px',
  color: vars.color.textMuted,
  fontSize: '0.82rem',
  textAlign: 'center',
  flexShrink: 0,
  userSelect: 'none',
});

export const timelineStartIcon = style({
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  backgroundColor: vars.color.bgTertiary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '4px',
  color: vars.color.textMuted,
});

export const timelineStartTitle = style({
  fontWeight: 600,
  fontSize: '0.88rem',
  color: vars.color.textSecondary,
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
  position: 'relative',
  ':hover': { backgroundColor: vars.color.bgHover },
});

// Grouped follow-up (same sender <5 min)
export const msgRowGrouped = style([msgRow, { paddingTop: '1px', paddingBottom: '1px' }]);

// Body column for classic (bubbles stack in a column, constrained width)
export const msgBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
  maxWidth: '75%',
});

// Sender name + timestamp row (classic — sits above the first bubble)
export const msgMeta = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
  marginBottom: '2px',
  flexWrap: 'wrap',
});
export const msgSender = style({
  fontWeight: 600,
  color: vars.color.accent,
  fontSize: '0.9rem',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  padding: 0,
  font: 'inherit',
  ':hover': { textDecoration: 'underline' },
});
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

// Body column for modern: full width, no constraint
export const msgBodyModern = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  flex: 1,
  minWidth: 0,
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
  transition: `opacity ${fast}`,
  selectors: {
    [`${msgRow}:hover &`]: { opacity: 1 },
    [`${msgRowGrouped}:hover &`]: { opacity: 1 },
  },
});

export const msgSticker = style({
  maxWidth: '320px',
  borderRadius: '8px',
});

export const msgVideo = style({
  maxWidth: '320px',
  maxHeight: '320px',
  borderRadius: '8px',
  display: 'block',
});

export const msgAudio = style({
  maxWidth: '320px',
  borderRadius: '8px',
  display: 'block',
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
  transition: `opacity ${fast}`,
  selectors: {
    [`${msgRow}:hover &`]: { opacity: 1 },
    [`${msgRowGrouped}:hover &`]: { opacity: 1 },
  },
});

export const redactedMsg = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
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
  transition: `border-color ${fast}, background-color ${fast}`,
  ':hover': { borderColor: vars.color.accent, backgroundColor: vars.color.bgHover },
  animationName: scaleIn,
  animationDuration: '120ms',
  animationTimingFunction: 'ease-out',
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
    transition: `opacity ${fast}, border-color ${fast}, background-color ${fast}`,
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

export const editContainer = style({
  borderRadius: '10px',
  border: `2px solid ${vars.color.accent}`,
  backgroundColor: vars.color.bgSecondary,
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  width: '100%',
  maxWidth: '90%',
  alignSelf: 'flex-start',
  position: 'relative',
});

export const editTextarea = style({
  width: '100%',
  minHeight: '50px',
  maxHeight: '200px',
  resize: 'none',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: vars.color.textPrimary,
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  lineHeight: '1.55',
  padding: '4px 0',
});

export const editActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '6px',
  alignItems: 'center',
});

export const editBtn = style({
  padding: '4px 12px',
  borderRadius: vars.radius.sm,
  fontSize: '0.82rem',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
  transition: `background-color ${fast}`,
});

export const editBtnSave = style([
  editBtn,
  {
    backgroundColor: vars.color.accent,
    color: '#fff',
    ':hover': { backgroundColor: vars.color.accentHover },
    ':disabled': { opacity: 0.5, cursor: 'default' },
  },
]);

export const editBtnCancel = style([
  editBtn,
  {
    backgroundColor: vars.color.bgTertiary,
    color: vars.color.textPrimary,
    ':hover': { backgroundColor: vars.color.bgHover },
  },
]);

export const unreadDivider = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 16px',
});

export const unreadDividerLines = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  '::before': { content: '""', flex: 1, height: '1px', backgroundColor: vars.color.accent },
  '::after': { content: '""', flex: 1, height: '1px', backgroundColor: vars.color.accent },
});

export const unreadDividerLabel = style({
  fontSize: '0.75rem',
  color: vars.color.accent,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
});

export const unreadDividerDismiss = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: vars.color.accent,
  color: '#fff',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
  opacity: 0.8,
  ':hover': { opacity: 1 },
});

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(6px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
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
  zIndex: 10,
  animationName: fadeIn,
  animationDuration: '120ms',
  animationTimingFunction: 'ease-out',
  ':hover': { backgroundColor: vars.color.accentHover },
});

export const scrollToBottomBadge = style({
  position: 'absolute',
  top: '-6px',
  right: '-6px',
  minWidth: '18px',
  height: '18px',
  borderRadius: '9px',
  backgroundColor: vars.color.danger,
  color: '#fff',
  fontSize: '0.65rem',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 4px',
  lineHeight: 1,
  pointerEvents: 'none',
});

export const tombstoneBanner = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  backgroundColor: vars.color.bgTertiary,
  borderBottom: `1px solid ${vars.color.border}`,
  fontSize: '0.9rem',
  color: vars.color.textPrimary,
  flexShrink: 0,
});

export const tombstoneBannerText = style({
  flex: 1,
});

export const tombstoneBannerBtn = style({
  padding: '6px 14px',
  borderRadius: vars.radius.sm,
  border: 'none',
  backgroundColor: vars.color.accent,
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  ':hover': {
    backgroundColor: vars.color.accentHover,
  },
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

const jumpFlashKeyframes = keyframes({
  '0%': { backgroundColor: vars.color.bgActive },
  '100%': { backgroundColor: 'transparent' },
});

export const jumpFlash = style({
  animationName: jumpFlashKeyframes,
  animationDuration: '1.5s',
  animationTimingFunction: 'ease-out',
  animationFillMode: 'forwards',
});

export const msgLive = style({
  animationName: fadeInUp,
  animationDuration: '120ms',
  animationTimingFunction: 'ease-out',
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

export const callEventIconMissed = style({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  color: vars.color.danger,
});

export const searchEmpty = style({
  padding: '32px 16px',
  textAlign: 'center',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
});

globalStyle('blockquote', {
  borderLeft: `2px solid ${vars.color.accent}`,
  paddingLeft: '12px',
  margin: '8px 0',
  color: vars.color.textMuted,
});

globalStyle('code', {
  backgroundColor: vars.color.bgTertiary,
  borderRadius: '4px',
  padding: '1px 5px',
  fontSize: '0.88em',
  fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
});

globalStyle('pre', {
  backgroundColor: vars.color.bgTertiary,
  borderRadius: '6px',
  padding: '12px',
  margin: '8px 0',
  overflowX: 'auto',
});

globalStyle('pre code', {
  backgroundColor: 'transparent',
  borderRadius: 0,
  padding: 0,
  fontSize: '0.85em',
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
  cursor: 'pointer',
  userSelect: 'text',
  lineHeight: '1.5',
});

// Self-mention pill — red/orange to stand out
globalStyle('.mention-pill-self', {
  backgroundColor: 'rgba(240, 100, 40, 0.18)',
  color: '#f06428',
});

// Classic bubble: mention pills use msgMentionPill for contrast
globalStyle(`${msgBubble} .mention-pill, ${msgBubbleOwn} .mention-pill`, {
  backgroundColor: `rgba(${vars.color.msgMentionPillRgb}, 0.18)`,
  color: vars.color.msgMentionPill,
});

// Self-mention stays orange in classic bubbles
globalStyle(`${msgBubble} .mention-pill-self, ${msgBubbleOwn} .mention-pill-self`, {
  backgroundColor: 'rgba(240, 100, 40, 0.18)',
  color: '#f06428',
});

// Spoiler / content warning — blurred until clicked
globalStyle('[data-mx-spoiler]', {
  filter: 'blur(5px)',
  cursor: 'pointer',
  userSelect: 'none',
  borderRadius: vars.radius.sm,
  transition: 'filter 0.2s ease',
});

globalStyle('[data-mx-spoiler-revealed="true"]', {
  filter: 'none',
  cursor: 'default',
  userSelect: 'auto',
});

// Spoiler reason label — displayed above the blurred content
globalStyle('.spoiler-reason', {
  display: 'block',
  fontSize: '0.72rem',
  color: vars.color.textMuted,
  marginBottom: '2px',
});

// Prettified link
globalStyle('a.prettified-link', {
  display: 'inline-grid',
  gridTemplateColumns: '1fr',
  position: 'relative',
  backgroundColor: `rgba(${vars.color.accentRgb}, 0.10)`,
  color: vars.color.textSecondary,
  borderRadius: '4px',
  padding: '0 6px',
  fontSize: '0.85em',
  fontWeight: 500,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  lineHeight: '1.6',
  transition: `background-color ${fast}, color ${fast}, text-decoration ${fast}`,
});

globalStyle('a.prettified-link .pretty-text, a.prettified-link .full-text', {
  gridArea: '1 / 1',
  whiteSpace: 'nowrap',
  transition: `opacity ${fast}`,
});

globalStyle('a.prettified-link .full-text', {
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  left: 0,
  top: 0,
  zIndex: 1,
});

globalStyle('a.prettified-link:hover', {
  backgroundColor: 'transparent',
  color: vars.color.accent,
  textDecoration: 'underline',
});

globalStyle('a.prettified-link:hover .pretty-text', {
  opacity: 0,
  pointerEvents: 'none',
});

globalStyle('a.prettified-link:hover .full-text', {
  opacity: 1,
  pointerEvents: 'auto',
  textDecoration: 'underline',
});

globalStyle(`${msgBubble} a, ${msgBubbleOwn} a`, {
  color: vars.color.textPrimary,
  textDecoration: 'underline',
});
globalStyle(`${msgBubble} a.prettified-link, ${msgBubbleOwn} a.prettified-link`, {
  border: `1px solid rgba(${vars.color.accentRgb}, 0.25)`,
  color: vars.color.textPrimary,
  textDecoration: 'none',
});
globalStyle(`${msgBubble} a.prettified-link:hover, ${msgBubbleOwn} a.prettified-link:hover`, {
  backgroundColor: 'transparent',
  color: vars.color.textPrimary,
  textDecoration: 'underline',
});

export const readReceiptRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  marginLeft: 'auto',
  alignSelf: 'flex-end',
  marginTop: '-14px',
  paddingRight: '16px',
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

export const msgSending = style({
  opacity: 0.6,
});

export const msgFailed = style({
  opacity: 0.6,
});

export const sendFailedRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexBasis: '100%',
  marginTop: '6px',
  paddingTop: '6px',
  borderTop: `1px solid ${vars.color.error}33`,
  opacity: 1,
  fontSize: '0.78rem',
  flexWrap: 'wrap',
});

export const sendFailedIcon = style({
  color: vars.color.error,
  flexShrink: 0,
});

export const sendFailedText = style({
  color: vars.color.error,
  fontSize: '0.78rem',
  fontWeight: 500,
});

const failedPill = style({
  fontSize: '0.72rem',
  padding: '2px 8px',
  borderRadius: '10px',
  border: `1px solid ${vars.color.border}`,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
  lineHeight: 1.4,
  background: 'none',
  transition: `border-color ${fast}, background-color ${fast}`,
});

export const sendRetryBtn = style([
  failedPill,
  {
    color: vars.color.accent,
    borderColor: vars.color.accent,
    ':hover': { backgroundColor: vars.color.bgActive, borderColor: vars.color.accentHover },
  },
]);

export const sendDiscardBtn = style([
  failedPill,
  {
    color: vars.color.textMuted,
    ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
  },
]);

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
