import { style, keyframes, globalStyle } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast, fadeInUp, scaleIn } from '@/theme/animations.css';

export const timelineContainer = style({
  flex: 1,
  backgroundColor: vars.color.bgPrimary,
  overflowY: 'auto',
  overflowX: 'hidden',
});

export const timelineBody = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  minHeight: '100%',
  padding: '8px 0',
});

export const timelineIntro = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '40px 16px 32px',
  flexShrink: 0,
});

export const timelinePlaceholder = style({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
});

const shimmer = keyframes({
  '0%': { backgroundPosition: '-400px 0' },
  '100%': { backgroundPosition: '400px 0' },
});

const pulse = keyframes({
  '0%': { opacity: 0.6 },
  '50%': { opacity: 1 },
  '100%': { opacity: 0.6 },
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
export const predecessorNotice = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 16px',
  fontSize: '0.82rem',
  color: vars.color.textMuted,
  textAlign: 'center',
  flexShrink: 0,
  borderBottom: `1px solid ${vars.color.border}`,
});

export const predecessorNoticeBtn = style({
  background: 'none',
  border: 'none',
  color: vars.color.accent,
  cursor: 'pointer',
  fontSize: '0.82rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  padding: 0,
  textDecoration: 'underline',
  whiteSpace: 'nowrap',
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
});

export const msgRowGrouped = style([msgRow, { paddingTop: '1px', paddingBottom: '1px' }]);

// Hover highlight region wrapping avatar + message body; the read-receipts column sits to its right
// so the highlight stops at the box edge. Highlighting also triggers from a row hover (e.g. moving
// the pointer over the receipts column) so the toolbar and the highlight stay in sync.
export const msgHoverRegion = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  flex: 1,
  minWidth: 0,
  position: 'relative',
  borderRadius: '12px',
  selectors: {
    '&:hover': { backgroundColor: vars.color.bgHover },
    [`${msgRow}:hover &`]: { backgroundColor: vars.color.bgHover },
    [`${msgRowGrouped}:hover &`]: { backgroundColor: vars.color.bgHover },
  },
});

// Sender name + timestamp row (sits above the first message content)
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
export const msgTime = style({
  color: vars.color.textMuted,
  fontSize: '0.72rem',
  opacity: 0,
  transition: `opacity ${fast}`,
  selectors: {
    [`${msgRow}:hover &`]: { opacity: 1 },
    [`${msgRowGrouped}:hover &`]: { opacity: 1 },
  },
});

export const msgBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  flex: 1,
  minWidth: 0,
  paddingRight: '12px',
});

export const msgContent = style({
  backgroundColor: 'transparent',
  color: vars.color.textPrimary,
  fontSize: '0.95rem',
  lineHeight: '1.55',
  wordBreak: 'break-word',
  position: 'relative',
  display: 'inline',
});

// Grouped follow-up: content only, already indented by avatar spacer
export const msgContentGrouped = style([
  msgContent,
  {
    display: 'inline-flex',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: '0 6px',
    maxWidth: '100%',
  },
]);

// Classic variant: same baseline structure, message content rendered inside bubbles.
const msgBubbleBase = {
  backgroundColor: vars.color.msgOtherBg,
  padding: '7px 12px',
  borderRadius: '12px',
};

export const msgContentClassic = style([
  msgContent,
  msgBubbleBase,
  { display: 'inline-block', alignSelf: 'flex-start' },
]);

export const msgContentClassicOwn = style([
  msgContentClassic,
  { backgroundColor: vars.color.msgMineBg },
]);

export const msgContentClassicGrouped = style([
  msgContentGrouped,
  msgBubbleBase,
  { alignSelf: 'flex-start' },
]);

export const msgContentClassicGroupedOwn = style([
  msgContentClassicGrouped,
  { backgroundColor: vars.color.msgMineBg },
]);

export const mediaBox = style({
  position: 'relative',
  overflow: 'hidden',
  width: '100%',
  maxWidth: '320px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.border,
  selectors: {
    [`${msgContentClassic} &, ${msgContentClassicOwn} &, ${msgContentClassicGrouped} &, ${msgContentClassicGroupedOwn} &`]:
      {
        width: '320px',
      },
  },
});

export const stickerBox = style({
  position: 'relative',
  overflow: 'hidden',
  width: '152px',
  borderRadius: vars.radius.sm,
});

export const mediaBoxPulse = style({
  position: 'absolute',
  inset: 0,
  animation: `${pulse} 1.5s ease-in-out infinite`,
  selectors: {
    [`${stickerBox} &`]: {
      backgroundColor: vars.color.border,
    },
  },
});

export const mediaBoxFillWrap = style({
  position: 'absolute',
  inset: 0,
  display: 'block',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
});

export const mediaFill = style({
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  display: 'block',
});

export const mediaClickable = style({
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  background: 'none',
  textAlign: 'initial',
});

export const videoExpandBtn = style({
  position: 'absolute',
  top: '8px',
  right: '8px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  borderRadius: vars.radius.sm,
  border: 'none',
  backgroundColor: 'rgba(0,0,0,0.5)',
  color: '#fff',
  cursor: 'pointer',
  zIndex: 1,
  transition: `background-color ${fast}`,
  ':hover': {
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
  },
});

export const msgAudioSkeleton = style({
  width: '280px',
  height: '56px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.border,
  animation: `${pulse} 1.5s ease-in-out infinite`,
});

export const mediaWrap = style({
  display: 'block',
  maxWidth: '320px',
});

export const mediaCaption = style({
  display: 'block',
  color: vars.color.textPrimary,
  fontSize: '0.9rem',
  lineHeight: '1.5',
  wordBreak: 'break-word',
  marginTop: '4px',
});

export const mediaError = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  maxWidth: '320px',
  padding: '4px 0',
  fontSize: '0.85rem',
  color: vars.color.textMuted,
});

export const animatedImageFill = style({
  position: 'relative',
  display: 'block',
  width: '100%',
  height: '100%',
});

export const animatedImageBadge = style({
  position: 'absolute',
  top: '6px',
  left: '6px',
  zIndex: 1,
  padding: '0 6px',
  lineHeight: '18px',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.5px',
  color: '#fff',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  borderRadius: '6px',
  pointerEvents: 'none',
  userSelect: 'none',
});

export const gallery = style({
  display: 'grid',
  gap: '4px',
  maxWidth: '400px',
  width: '100%',
  borderRadius: '12px',
  padding: '2px',
  selectors: {
    [`${msgContentClassic} &, ${msgContentClassicOwn} &, ${msgContentClassicGrouped} &, ${msgContentClassicGroupedOwn} &`]:
      {
        width: '400px',
      },
  },
});

export const galleryTile = style({
  position: 'relative',
  overflow: 'hidden',
  border: 'none',
  padding: 0,
  margin: 0,
  display: 'block',
  minHeight: 0,
  minWidth: 0,
  width: '100%',
  borderRadius: '8px',
  backgroundColor: vars.color.border,
  cursor: 'zoom-in',
  ':hover': {
    filter: 'brightness(1.08)',
  },
});

export const galleryTileImg = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  userSelect: 'none',
});

export const galleryTileSkeleton = style({
  width: '100%',
  height: '100%',
  minHeight: '48px',
  backgroundColor: vars.color.border,
  animation: `${pulse} 1.5s ease-in-out infinite`,
});

export const galleryMore = style([
  galleryTile,
  {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 600,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    cursor: 'zoom-in',
    ':hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
  },
]);

export const fileSkeleton = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  opacity: 0.5,
  animation: `${pulse} 1.5s ease-in-out infinite`,
});

export const loadingText = style({
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

const editedMarkerBase = {
  fontSize: '0.72rem',
  color: vars.color.textMuted,
  fontStyle: 'italic',
  whiteSpace: 'nowrap',
};

// Inline next to the sender name, revealed on row hover
export const editedMarkerHeader = style([
  editedMarkerBase,
  {
    opacity: 0,
    transition: `opacity ${fast}`,
    selectors: {
      [`${msgRow}:hover &`]: { opacity: 1 },
      [`${msgRowGrouped}:hover &`]: { opacity: 1 },
    },
  },
]);

// Sits inside grouped content next to the message text, revealed on row hover
export const editedMarkerGrouped = style([
  editedMarkerBase,
  {
    lineHeight: '1.55',
    alignSelf: 'flex-end',
    flexShrink: 0,
    opacity: 0,
    transition: `opacity ${fast}`,
    selectors: {
      [`${msgRow}:hover &`]: { opacity: 1 },
      [`${msgRowGrouped}:hover &`]: { opacity: 1 },
    },
  },
]);

// Same spot but always visible (classic variant)
export const editedMarkerGroupedClassic = style([
  editedMarkerBase,
  {
    lineHeight: '1.55',
    alignSelf: 'flex-end',
    flexShrink: 0,
  },
]);

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

const markdownContentClasses = [
  msgContent,
  msgContentGrouped,
  msgContentClassic,
  msgContentClassicOwn,
  msgContentClassicGrouped,
  msgContentClassicGroupedOwn,
  emoteMsg,
  noticeMsg,
];

const scopedListSelectors = (children: string): string =>
  children
    .split(',')
    .map((child) => child.trim())
    .flatMap((child) => markdownContentClasses.map((c) => `${c} ${child}`))
    .join(', ');

globalStyle(scopedListSelectors('ol, ul'), {
  margin: '6px 0',
  paddingLeft: '1.6em',
  listStylePosition: 'outside',
});
globalStyle(scopedListSelectors('ol'), {
  listStyleType: 'decimal',
});
globalStyle(scopedListSelectors('ul'), {
  listStyleType: 'disc',
});
globalStyle(scopedListSelectors('li'), {
  margin: '2px 0',
});
globalStyle(scopedListSelectors('ol ol, ul ul, ol ul, ul ol'), {
  marginTop: '2px',
  marginBottom: '2px',
});

export const locationMsg = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: vars.color.textSecondary,
});

export const locationLink = style({
  color: vars.color.accent,
  textDecoration: 'none',
  fontWeight: 500,
  selectors: {
    '&:hover': { textDecoration: 'underline' },
  },
});

export const emojiOnly = style({
  fontSize: '2.5rem',
  lineHeight: 1.2,
});

export const replyQuote = style({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: vars.color.textMuted,
  borderLeft: `3px solid ${vars.color.accent}`,
  paddingLeft: '8px',
  marginBottom: '4px',
  fontSize: '0.95rem',
  borderRadius: '2px',
  cursor: 'pointer',
  ':hover': {
    color: vars.color.textPrimary,
  },
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
  transition: `opacity ${fast}, border-color ${fast}, background-color ${fast}`,
  ':hover': { borderColor: vars.color.accent, backgroundColor: vars.color.bgHover },
  animationName: scaleIn,
  animationDuration: '120ms',
  animationTimingFunction: 'ease-out',
  selectors: {
    '[data-hovered="false"] &': { opacity: 0.8 },
    '[data-hovered="true"] &': { opacity: 1 },
  },
});

export const reactionChipOwn = style([
  reactionChip,
  {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.bgActive,
    ':hover': { backgroundColor: vars.color.bgActive, borderColor: vars.color.accentHover },
  },
]);

export const reactionImg = style({
  width: '1.1rem',
  height: '1.1rem',
  verticalAlign: 'middle',
  objectFit: 'contain',
});

export const inlinePackEmoji = style({
  display: 'inline-block',
  width: 'auto',
  height: '1em',
  verticalAlign: 'middle',
  objectFit: 'contain',
  margin: '0 1px',
});

globalStyle('img[data-mx-emoticon]', {
  display: 'inline-block',
  width: 'auto',
  height: '1em',
  verticalAlign: 'middle',
  objectFit: 'contain',
  margin: '0 1px',
});

export const reactionQuickAdd = style([
  reactionChip,
  {
    padding: '2px 8px',
    color: vars.color.textMuted,
    opacity: 0,
    transition: `opacity ${fast}, border-color ${fast}, background-color ${fast}`,
    selectors: {
      '[data-hovered="false"] &': { opacity: 0 },
      '[data-hovered="true"] &': { opacity: 1 },
    },
    '@media': {
      '(pointer: coarse)': {
        opacity: 1,
      },
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
  color: 'inherit',
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

// Slate rich editor inside the inline edit bubble
export const editRichEditor = style({
  width: '100%',
  minHeight: '50px',
  maxHeight: '200px',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: vars.color.textPrimary,
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  lineHeight: '1.55',
  padding: '4px 0',
  overflowY: 'auto',
  wordBreak: 'break-word',
});

globalStyle(`${editRichEditor} p`, { margin: 0 });
globalStyle(`${editRichEditor} p + p`, { marginTop: '2px' });
globalStyle(`${editRichEditor} blockquote`, {
  margin: '2px 0',
  paddingLeft: '10px',
  borderLeft: `3px solid ${vars.color.accent}`,
  color: vars.color.textMuted,
});
globalStyle(`${editRichEditor} pre`, {
  margin: '2px 0',
  padding: '4px 8px',
  backgroundColor: vars.color.bgTertiary,
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '0.9em',
  overflowX: 'auto',
});
globalStyle(`${editRichEditor} code`, {
  backgroundColor: vars.color.bgTertiary,
  borderRadius: '3px',
  padding: '1px 4px',
  fontFamily: 'monospace',
  fontSize: '0.9em',
});
globalStyle(`${editRichEditor} a`, {
  color: vars.color.accent,
  textDecoration: 'underline',
  cursor: 'pointer',
});
globalStyle(`${editRichEditor} [data-slate-placeholder]`, {
  color: vars.color.textMuted,
  pointerEvents: 'none',
  userSelect: 'none',
});
globalStyle(`${editRichEditor} .mention-pill`, {
  display: 'inline-block',
  backgroundColor: `color-mix(in srgb, ${vars.color.accent} 15%, transparent)`,
  color: vars.color.accent,
  borderRadius: '4px',
  padding: '0 4px',
  fontSize: '0.9em',
  fontWeight: 600,
  userSelect: 'none',
  cursor: 'default',
});

export const editActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '6px',
  alignItems: 'center',
});

export const editEmojiArea = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
});

export const editEmojiBtn = style({
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  flexShrink: 0,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
});

export const editEmojiPicker = style({
  position: 'absolute',
  right: 0,
  bottom: 'calc(100% + 6px)',
  width: '352px',
  height: '440px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
  zIndex: 120,
  display: 'flex',
  flexDirection: 'column',
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
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 16px',
});

export const unreadDividerLines = style({
  flex: 1,
  height: '1px',
  backgroundColor: vars.color.accent,
});

export const unreadDividerLabel = style({
  textAlign: 'center',
  fontSize: '0.75rem',
  color: vars.color.accent,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
});

export const unreadDividerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const unreadDividerDismiss = style({
  flexShrink: 0,
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
  position: 'relative',
});

globalStyle('pre code', {
  backgroundColor: 'transparent',
  borderRadius: 0,
  padding: 0,
  fontSize: '0.85em',
});

export const richHtmlSegment = style({
  display: 'contents',
});

export const codeBlock = style({
  margin: '8px 0',
  borderRadius: '6px',
  overflow: 'hidden',
});

globalStyle(`${codeBlock} pre`, {
  margin: 0,
  borderRadius: 0,
});

export const codeBlockHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '4px 12px',
  backgroundColor: vars.color.bgTertiary,
  borderBottom: `1px solid ${vars.color.border}`,
});

export const codeBlockLabel = style({
  fontSize: '0.72rem',
  fontWeight: 600,
  color: vars.color.textMuted,
  textTransform: 'lowercase',
  fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
});

export const codeCopyBtn = style({
  flexShrink: 0,
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

globalStyle('.mention-pill:focus-visible', {
  outline: `2px solid ${vars.color.accent}`,
  outlineOffset: '1px',
});

// Self-mention pill — red/orange to stand out
globalStyle('.mention-pill-self', {
  backgroundColor: 'rgba(240, 100, 40, 0.18)',
  color: '#f06428',
});

globalStyle('.room-mention', {
  backgroundColor: 'rgba(240, 100, 40, 0.16)',
  color: '#f06428',
  borderRadius: '3px',
  padding: '0 2px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
});

globalStyle('.mention-pill.room-mention-pill', {
  backgroundColor: 'rgba(240, 100, 40, 0.22)',
  color: '#f06428',
});

const bubbleClasses = [
  msgContentClassic,
  msgContentClassicOwn,
  msgContentClassicGrouped,
  msgContentClassicGroupedOwn,
];
const bubbleSelector = (descendant: string) =>
  bubbleClasses.map((c) => `${c} ${descendant}`).join(', ');

// Classic bubbles: mention pills use msgMentionPill for contrast
globalStyle(bubbleSelector('.mention-pill'), {
  backgroundColor: `rgba(${vars.color.msgMentionPillRgb}, 0.18)`,
  color: vars.color.msgMentionPill,
});

// Self-mention stays orange in classic bubbles
globalStyle(bubbleSelector('.mention-pill-self'), {
  backgroundColor: 'rgba(240, 100, 40, 0.18)',
  color: '#f06428',
});

globalStyle(bubbleSelector('.room-mention'), {
  backgroundColor: 'rgba(240, 100, 40, 0.16)',
  color: '#f06428',
});

globalStyle(bubbleSelector('.mention-pill.room-mention-pill'), {
  backgroundColor: 'rgba(240, 100, 40, 0.22)',
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
  gridTemplateColumns: 'minmax(0, auto)',
  position: 'relative',
  backgroundColor: `rgba(${vars.color.accentRgb}, 0.10)`,
  color: vars.color.textSecondary,
  borderRadius: '4px',
  padding: '0 6px',
  fontSize: '0.85em',
  fontWeight: 500,
  textDecoration: 'none',
  lineHeight: '1.6',
  maxWidth: '100%',
  transition: `background-color ${fast}, color ${fast}, text-decoration ${fast}`,
});

globalStyle('a.prettified-link .pretty-text', {
  gridArea: '1 / 1',
  whiteSpace: 'nowrap',
});

globalStyle('a.prettified-link .full-text', {
  gridArea: '1 / 1',
  display: 'none',
});

globalStyle('a.prettified-link:hover', {
  backgroundColor: 'transparent',
  color: vars.color.accent,
  textDecoration: 'underline',
});

globalStyle('a.prettified-link:hover .pretty-text', {
  display: 'none',
});

globalStyle('a.prettified-link:hover .full-text', {
  display: 'block',
  whiteSpace: 'normal',
  wordBreak: 'break-all',
  textDecoration: 'underline',
});

globalStyle(bubbleSelector('a'), {
  color: vars.color.textPrimary,
  textDecoration: 'underline',
});
globalStyle(bubbleSelector('a.prettified-link'), {
  border: `1px solid rgba(${vars.color.accentRgb}, 0.25)`,
  color: vars.color.textPrimary,
  textDecoration: 'none',
});
globalStyle(bubbleSelector('a.prettified-link:hover'), {
  backgroundColor: 'transparent',
  color: vars.color.textPrimary,
  textDecoration: 'underline',
});

export const readReceiptRow = style({
  display: 'flex',
  alignItems: 'center',
  alignSelf: 'flex-end',
  flexShrink: 0,
  width: '52px',
  minHeight: '16px',
});

export const readReceiptRowSpaced = style({
  marginTop: 0,
  paddingTop: '2px',
});

export const threadBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  marginTop: '4px',
  fontSize: '0.82rem',
  color: vars.color.accent,
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  padding: '2px 6px',
  borderRadius: vars.radius.sm,
  fontFamily: 'inherit',
  fontWeight: 500,
  alignSelf: 'flex-start',
  transition: `background-color ${fast}`,
  ':hover': { backgroundColor: vars.color.bgHover },
});

export const threadBadgeParticipatedDot = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  flexShrink: 0,
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
  marginLeft: '-6px',
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
  marginRight: '2px',
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
