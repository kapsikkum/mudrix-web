import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

// The Jitsi slot lives inside this at all times (never moves).
// Height collapses to 0 when not in a call or when in PIP mode.

export const embed = style({
  width: '100%',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backgroundColor: '#111113',
  borderBottom: `1px solid ${vars.color.border}`,
  transition: 'height 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
});

export const embedHidden = style({
  height: '0px !important',
  overflow: 'hidden',
  borderBottom: 'none',
});

export const resizeBar = style({
  width: '100%',
  height: '6px',
  flexShrink: 0,
  cursor: 'ns-resize',
  position: 'relative',
  zIndex: 3,
  backgroundColor: vars.color.bgSecondary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s',
  selectors: {
    '&:hover': { backgroundColor: vars.color.bgTertiary },
    '&:active': { backgroundColor: vars.color.accent },
  },
  '::after': {
    content: '""',
    width: '32px',
    height: '3px',
    borderRadius: '2px',
    backgroundColor: vars.color.textMuted,
    opacity: 0.4,
  },
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 10px',
  height: '49px',
  flexShrink: 0,
  backgroundColor: vars.color.bgSecondary,
  borderBottom: `1px solid ${vars.color.border}`,
  userSelect: 'none',
  position: 'relative',
  zIndex: 2,
});

export const headerTitle = style({
  fontSize: '1rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

export const headerControls = style({
  display: 'flex',
  gap: '4px',
  flexShrink: 0,
});

export const headerBtn = style({
  background: 'transparent',
  border: 'none',
  color: vars.color.textMuted,
  cursor: 'pointer',
  padding: '4px 7px',
  borderRadius: vars.radius.sm,
  fontSize: '0.78rem',
  lineHeight: '1',
  ':hover': { color: vars.color.textPrimary, backgroundColor: vars.color.bgTertiary },
});

// In embed mode: fills the space below the header.
// In PIP mode:   position:fixed applied inline by JS, effectively detaches it
//                visually from the in-flow panel (which collapses to 0 height).

export const iframeWrap = style({
  flex: 1,
  minHeight: 0,
  position: 'relative',
});

// This is purely decorative/interactive; the iframe slot is positioned
// independently via inline style set by the drag/resize logic.

export const pipChrome = style({
  position: 'fixed',
  bottom: '80px',
  right: '20px',
  width: '420px',
  height: '270px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  zIndex: 1001, // above the slot (z-index 1000)
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  pointerEvents: 'none', // pass clicks through to iframe by default
  overflow: 'hidden',
});

export const pipHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 10px',
  height: '36px',
  flexShrink: 0,
  backgroundColor: vars.color.bgSecondary,
  borderBottom: `1px solid ${vars.color.border}`,
  userSelect: 'none',
  cursor: 'grab',
  pointerEvents: 'all', // re-enable for the header so drag works
  selectors: { '&:active': { cursor: 'grabbing' } },
});

export const resizeHandle = style({
  position: 'absolute',
  bottom: 0,
  right: 0,
  width: '16px',
  height: '16px',
  cursor: 'se-resize',
  background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.25) 50%)',
  zIndex: 10,
  pointerEvents: 'all',
});

const fadeIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

export const joinCard = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  padding: '24px 16px',
  backgroundColor: vars.color.bgTertiary,
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
  animationName: fadeIn,
  animationDuration: '0.2s',
});

export const joinTitle = style({
  fontSize: '0.9rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const joinSubtitle = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
});

export const joinBtn = style({
  padding: '8px 24px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.success,
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 600,
  transition: 'background-color 0.15s',
  ':hover': { filter: 'brightness(1.1)' },
});
