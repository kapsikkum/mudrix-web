export const modalScaleIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translate(-50%, -50%) scale(0.95)',
  },
  '100%': {
    opacity: 1,
    transform: 'translate(-50%, -50%) scale(1)',
  },
});

import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { scaleIn, fast } from '@/theme/animations.css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 7500,
  '@media': {
    'screen and (max-width: 768px)': {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
  },
});

export const popup = style({
  position: 'fixed',
  zIndex: 7501,
  width: '320px',
  backgroundColor: vars.color.bgPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: '16px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  animation: `${scaleIn} ${fast} ease`,
  display: 'flex',
  flexDirection: 'column',
  padding: 0,
  maxHeight: 'calc(100vh - 32px)',
  '@media': {
    // Bottom sheet on phones: full width, pinned to the bottom edge, scrolls if tall.
    'screen and (max-width: 768px)': {
      left: '0 !important',
      right: '0 !important',
      top: 'auto !important',
      bottom: '0 !important',
      transform: 'none !important',
      width: 'auto',
      maxHeight: '88dvh',
      overflowY: 'auto',
      borderRadius: '20px 20px 0 0',
      borderBottom: 'none',
      paddingBottom: 'env(safe-area-inset-bottom)',
    },
  },
  // Visible so an avatar decoration can spill past the card edge (as on Discord); the cover
  // rounds its own top corners instead of relying on the card to clip it.
  overflow: 'visible',
});

export const coverWrap = style({
  margin: '-20px -20px 0',
  position: 'relative',
  height: '110px',
  flexShrink: 0,
  overflow: 'hidden',
  borderTopLeftRadius: vars.radius.md,
  borderTopRightRadius: vars.radius.md,
});

export const popoutCoverWrap = style({
  position: 'relative',
  height: '110px',
  width: '100%',
  flexShrink: 0,
  overflow: 'hidden',
  borderTopLeftRadius: '15px',
  borderTopRightRadius: '15px',
});

export const cover = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  pointerEvents: 'none',
});

export const coverFallback = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
});

export const coverNeutral = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  backgroundColor: vars.color.bgTertiary,
});

export const popoutAvatarRow = style({
  position: 'relative',
  marginTop: '-42px',
  padding: '0 16px',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  zIndex: 3,
});

export const cardBody = style({
  margin: '8px 12px 14px',
  padding: '12px 14px',
  borderRadius: '8px',
  backgroundColor: vars.color.bgSecondary,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  position: 'relative',
  zIndex: 3,
  maxHeight: 'min(320px, calc(100vh - 240px))',
  overflowY: 'auto',
  overflowX: 'hidden',
  selectors: {
    '&::-webkit-scrollbar': {
      width: '4px',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: vars.color.bgHover,
      borderRadius: '2px',
    },
  },
});

export const bodyDivider = style({
  width: '100%',
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '4px 0',
  flexShrink: 0,
});

export const sectionHeader = style({
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: vars.color.textMuted,
  marginBottom: '2px',
});

export const frameClearance = style({
  height: '32px',
  flexShrink: 0,
  pointerEvents: 'none',
});

export const topRow = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '4px',
  marginTop: '-42px',
  position: 'relative',
  zIndex: 2,
});

export const avatarRow = style({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '4px',
  width: '100%',
});

export const avatarWrap = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  borderRadius: '50%',
  lineHeight: 0,
  flexShrink: 0,
  backgroundColor: vars.color.bgPrimary,
  padding: '4px',
  boxShadow: `0 0 0 1px ${vars.color.border}`,
});

export const nameSection = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '2px',
  minWidth: 0,
  maxWidth: '100%',
});

export const displayName = style({
  fontSize: '1.05rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
  wordBreak: 'break-word',
  lineHeight: 1.3,
});

export const userIdRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const userId = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
  fontFamily: 'monospace',
  wordBreak: 'break-all',
  lineHeight: 1.3,
});

export const infoRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.85rem',
});

export const infoIcon = style({
  display: 'flex',
  alignItems: 'center',
  color: vars.color.textMuted,
  flexShrink: 0,
});

export const infoValue = style({
  color: vars.color.textPrimary,
  fontWeight: 500,
  marginRight: 'auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const roleBadge = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '2px 8px 2px 6px',
  borderRadius: vars.radius.sm,
  textTransform: 'capitalize',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  color: vars.color.textPrimary,
});

export const roleDot = style({
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  flexShrink: 0,
});

export const roleAdminDot = style([roleDot, { backgroundColor: '#ef4444' }]);
export const roleModeratorDot = style([roleDot, { backgroundColor: '#eab308' }]);
export const roleMemberDot = style([roleDot, { backgroundColor: '#3b82f6' }]);
export const roleFounderDot = style([roleDot, { backgroundColor: '#a855f7' }]);

export const roleAdmin = style([roleBadge]);
export const roleModerator = style([roleBadge]);
export const roleMember = style([roleBadge]);
export const roleFounder = style([roleBadge]);

export const modActions = style({
  display: 'flex',
  gap: '8px',
});

export const modActionBtn = style({
  flex: 1,
});

export const primaryRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const primaryBtn = style({
  flex: 1,
});

export const hiddenInput = style({
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
});

export const avatarWrapEditable = style({
  position: 'relative',
});

export const avatarEdit = style({
  position: 'absolute',
  inset: '4px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.4)',
  color: 'rgba(255,255,255,0.9)',
  opacity: 0,
  transition: 'opacity 0.15s ease',
  pointerEvents: 'none',
  selectors: {
    [`${avatarWrapEditable}:hover &`]: { opacity: 1 },
  },
});

export const accountsSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const accountsDivider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '2px 0',
});

export const switchRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  width: '100%',
  padding: '8px',
  borderRadius: vars.radius.sm,
  border: '1px solid transparent',
  backgroundColor: 'transparent',
  color: vars.color.textPrimary,
  fontSize: '0.9rem',
  fontWeight: 500,
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgTertiary,
    },
  },
});

export const accountsFlyout = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: '240px',
});

export const accountRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '6px 8px',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  border: '1px solid transparent',
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgTertiary,
    },
  },
});

export const accountRowActive = style({
  border: `1px solid ${vars.color.success}`,
  backgroundColor: vars.color.bgTertiary,
  cursor: 'default',
});

export const accountMeta = style({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  flex: 1,
});

export const accountName = style({
  fontSize: '0.85rem',
  fontWeight: 500,
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const accountServer = style({
  fontSize: '0.75rem',
  color: vars.color.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const pronouns = style({
  fontSize: '0.8rem',
  color: vars.color.textSecondary,
  lineHeight: 1.3,
});

export const bioBox = style({
  fontSize: '0.85rem',
  color: vars.color.textPrimary,
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  maxHeight: '140px',
  overflowY: 'auto',
  padding: '8px 10px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
});

export const bioLink = style({
  color: vars.color.accent,
  textDecoration: 'none',
  selectors: {
    '&:hover': { textDecoration: 'underline' },
  },
});

export const timeValue = style({
  color: vars.color.textPrimary,
  fontWeight: 500,
});

export const timeOffset = style({
  color: vars.color.textMuted,
  marginLeft: '6px',
});

export const note = style({
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  margin: 0,
});

export const viewFullProfileBtn = style({
  width: '100%',
  marginTop: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '8px 12px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  color: vars.color.textPrimary,
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: `background-color ${fast}`,
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgHover,
    },
  },
});

export const fullModalOverlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 7500,
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
  backdropFilter: 'blur(2px)',
});

export const fullModal = style({
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 7501,
  width: '760px',
  maxWidth: 'calc(100vw - 32px)',
  height: '560px',
  maxHeight: 'calc(100vh - 32px)',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
  animation: `${modalScaleIn} ${fast} ease`,
  display: 'flex',
  overflow: 'visible',
  '@media': {
    'screen and (max-width: 680px)': {
      flexDirection: 'column',
      height: 'auto',
      maxHeight: '90vh',
      overflowY: 'auto',
    },
  },
});

/**
 * Holds the left pane and its profile frame: the pane scrolls and clips, the frame is a sibling
 * so it can overhang the pane without being clipped (and never covers the right pane).
 */
export const fullModalLeftWrap = style({
  position: 'relative',
  display: 'flex',
  width: '300px',
  flexShrink: 0,
  '@media': {
    'screen and (max-width: 680px)': {
      width: '100%',
    },
  },
});

export const fullModalLeft = style({
  flex: 1,
  minWidth: 0,
  borderTopLeftRadius: vars.radius.lg,
  borderBottomLeftRadius: vars.radius.lg,
  backgroundColor: vars.color.bgPrimary,
  borderRight: `1px solid ${vars.color.border}`,
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  overflowY: 'auto',
  padding: '20px',
  gap: '14px',
  '@media': {
    'screen and (max-width: 680px)': {
      width: '100%',
      borderRight: 'none',
      borderBottom: `1px solid ${vars.color.border}`,
    },
  },
});

export const fullModalRight = style({
  flex: 1,
  minWidth: 0,
  // The modal no longer clips, so the right pane rounds its own outer corners.
  borderTopRightRadius: vars.radius.lg,
  borderBottomRightRadius: vars.radius.lg,
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  backgroundColor: vars.color.bgSecondary,
});

export const fullModalHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px 0',
  borderBottom: `1px solid ${vars.color.border}`,
});

export const fullModalTabs = style({
  display: 'flex',
  gap: '8px',
});

export const fullModalTab = style({
  padding: '8px 12px',
  fontSize: '0.9rem',
  fontWeight: 600,
  color: vars.color.textSecondary,
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  selectors: {
    '&:hover': {
      color: vars.color.textPrimary,
    },
    '&[aria-selected="true"]': {
      color: vars.color.textPrimary,
      borderBottomColor: vars.color.accent,
    },
  },
});

export const fullModalTabBadge = style({
  padding: '1px 6px',
  borderRadius: '999px',
  backgroundColor: vars.color.bgTertiary,
  fontSize: '0.75rem',
  color: vars.color.textMuted,
});

export const fullModalCloseBtn = style({
  padding: '6px',
  borderRadius: '50%',
  backgroundColor: 'transparent',
  border: 'none',
  color: vars.color.textMuted,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgHover,
      color: vars.color.textPrimary,
    },
  },
});

export const fullModalBody = style({
  flex: 1,
  padding: '16px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

export const notesSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
});

export const notesLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  color: vars.color.textMuted,
});

export const notesTextarea = style({
  width: '100%',
  minHeight: '60px',
  resize: 'vertical',
  padding: '8px 10px',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textPrimary,
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  lineHeight: 1.4,
  selectors: {
    '&::placeholder': { color: vars.color.textMuted },
    '&:focus': { outline: 'none', borderColor: vars.color.accent },
  },
});

export const notesSaved = style({
  fontSize: '0.7rem',
  color: vars.color.textMuted,
  alignSelf: 'flex-end',
  opacity: 0,
  transition: `opacity ${fast}`,
  selectors: {
    '&[data-visible="true"]': { opacity: 1 },
  },
});
