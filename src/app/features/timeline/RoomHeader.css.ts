import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const ROOM_HEADER_HEIGHT = 49;

export const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '0 16px',
  height: `${ROOM_HEADER_HEIGHT}px`,
  flexShrink: 0,
  backgroundColor: vars.color.bgSecondary,
  borderBottom: `1px solid ${vars.color.border}`,
  zIndex: 10,
});

export const nameContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  '@media': {
    '(max-width: 768px)': {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: '0px',
    },
  },
});

export const nameRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
  '@media': {
    '(max-width: 768px)': {
      width: '100%',
    },
  },
});

export const roomIcon = style({
  color: vars.color.textMuted,
  flexShrink: 0,
  '@media': {
    '(max-width: 768px)': {
      display: 'none',
    },
  },
});

export const roomName = style({
  fontWeight: 700,
  fontSize: '1rem',
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

export const topicDivider = style({
  width: '3px',
  height: '3px',
  borderRadius: '50%',
  backgroundColor: vars.color.textMuted,
  flexShrink: 0,
  opacity: 0.5,
  '@media': {
    '(max-width: 768px)': {
      display: 'none',
    },
  },
});

export const topicTrigger = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  minWidth: 0,
  textAlign: 'left',
  padding: '2px 4px',
  margin: '0 -4px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  borderRadius: vars.radius.sm,
  transition: `color ${fast}, text-decoration-color ${fast}`,
  ':hover': {
    textDecoration: 'underline',
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '1px',
  },
  '@media': {
    '(max-width: 768px)': {
      flex: 'initial',
      width: '100%',
      fontSize: '0.75rem',
      padding: '0 4px',
    },
  },
});

export const headerDivider = style({
  width: '1px',
  height: '20px',
  backgroundColor: vars.color.border,
  margin: '0 4px',
});

export const desktopOnly = style({
  display: 'contents',
  '@media': {
    '(max-width: 768px)': {
      display: 'none',
    },
  },
});

export const headerBtn = style({
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
  flexShrink: 0,
  transition: `background-color ${fast}, color ${fast}`,
  ':disabled': {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: vars.color.bgHover,
      color: vars.color.textPrimary,
    },
  },
});

export const headerBtnActive = style([
  headerBtn,
  {
    color: vars.color.accent,
    selectors: {
      '&&:hover:not(:disabled)': {
        backgroundColor: vars.color.bgHover,
        color: vars.color.accent,
      },
    },
  },
]);

export const searchBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 16px',
  backgroundColor: vars.color.bgSecondary,
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const searchInline = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const searchInputWrap = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  backgroundColor: vars.color.bgInput,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  padding: '6px 10px',
  ':focus-within': {
    borderColor: vars.color.accent,
  },
});

export const searchIcon = style({
  color: vars.color.textMuted,
  fontSize: '0.85rem',
  flexShrink: 0,
});

export const searchInput = style({
  flex: 1,
  border: 'none',
  background: 'none',
  color: vars.color.textPrimary,
  fontSize: '0.95rem',
  outline: 'none',
  '::placeholder': { color: vars.color.textMuted },
});

export const searchCount = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

export const searchNavBtn = style({
  width: '24px',
  height: '24px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  color: vars.color.textMuted,
  fontSize: '0.75rem',
  flexShrink: 0,
  ':disabled': { opacity: 0.35, cursor: 'not-allowed' },
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: vars.color.bgHover,
      color: vars.color.textPrimary,
    },
  },
});

export const searchCloseBtn = style([
  headerBtn,
  { width: '28px', height: '28px', fontSize: '0.85rem' },
]);

const slideDown = keyframes({
  from: { opacity: 0, transform: 'translateY(-8px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

export const pinnedPanel = style({
  position: 'absolute',
  top: '49px',
  left: 0,
  right: 0,
  zIndex: 20,
  backgroundColor: vars.color.bgSecondary,
  borderBottom: `1px solid ${vars.color.border}`,
  animation: `${slideDown} ${fast} ease-out`,
  maxHeight: '320px',
  overflowY: 'auto',
});

export const pinnedPanelHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px 8px',
  borderBottom: `1px solid ${vars.color.border}`,
});

export const pinnedPanelTitle = style({
  fontSize: '0.82rem',
  fontWeight: 700,
  color: vars.color.textMuted,
  letterSpacing: '0.05em',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

export const pinnedItem = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '10px 16px',
  cursor: 'pointer',
  borderBottom: `1px solid ${vars.color.border}`,
  transition: `background-color ${fast}`,
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
  ':last-child': {
    borderBottom: 'none',
  },
});

export const pinnedPin = style({
  color: vars.color.accent,
  fontSize: '0.75rem',
  marginTop: '2px',
  flexShrink: 0,
});

export const pinnedContent = style({
  flex: 1,
  minWidth: 0,
});

export const pinnedSender = style({
  fontSize: '0.82rem',
  fontWeight: 600,
  color: vars.color.accent,
  marginBottom: '2px',
});

export const pinnedBody = style({
  fontSize: '0.95rem',
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const pinnedEmpty = style({
  padding: '24px 16px',
  fontSize: '0.95rem',
  color: vars.color.textMuted,
  textAlign: 'center',
});

export const topicPanel = style({
  position: 'absolute',
  top: '49px',
  left: 0,
  right: 0,
  zIndex: 20,
  backgroundColor: vars.color.bgSecondary,
  borderBottom: `1px solid ${vars.color.border}`,
  animation: `${slideDown} ${fast} ease-out`,
  maxHeight: '200px',
  overflowY: 'auto',
  padding: '10px 16px',
});

export const topicPanelText = style({
  margin: 0,
  fontSize: '0.9rem',
  lineHeight: 1.5,
  color: vars.color.textPrimary,
  whiteSpace: 'normal',
  overflowWrap: 'break-word',
  wordBreak: 'break-word',
});

export const searchHighlight = style({
  backgroundColor: `rgba(${vars.color.accentRgb}, 0.35)`,
  borderRadius: '2px',
  padding: '0 1px',
});

export const headerWrapper = style({
  position: 'relative',
  flexShrink: 0,
});
