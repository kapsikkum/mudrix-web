import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { ROOM_HEADER_HEIGHT } from '@/app/features/timeline/RoomHeader.css';

export const EMBED_HEADER_HEIGHT = 49;

export const embedContainer = style({
  position: 'relative',
  width: '100%',
  flexShrink: 0,
  height: 0,
  minHeight: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  visibility: 'hidden',
  opacity: 0,
  backgroundColor: '#111113',
});

export const embedContainerActive = style({
  pointerEvents: 'auto',
  visibility: 'visible',
  opacity: 1,
  paddingTop: `${EMBED_HEADER_HEIGHT}px`,
  transition: `height 300ms cubic-bezier(0.4, 0, 0.2, 1), padding-top 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms ease`,
});

export const pip = style({
  position: 'fixed',
  top: 'auto',
  left: 'auto',
  right: '24px',
  bottom: '88px',
  width: '420px',
  height: '270px',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  zIndex: 1000,
  paddingTop: 0,
  '@media': {
    // Fit the floating call window to the screen on phones.
    '(max-width: 768px)': {
      right: '12px',
      width: 'min(420px, calc(100vw - 24px))',
      height: 'min(270px, calc((100vw - 24px) * 0.64))',
    },
  },
});

export const fullscreen = style({
  position: 'absolute',
  top: `${ROOM_HEADER_HEIGHT}px`,
  left: 0,
  right: 0,
  bottom: 0,
  height: 'auto',
  zIndex: 6000,
});

const chromeBar = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '0 16px',
  zIndex: 70,
  pointerEvents: 'auto',
  userSelect: 'none',
} as const;

export const embedHeader = style([
  chromeBar,
  {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `${EMBED_HEADER_HEIGHT}px`,
    backgroundColor: vars.color.bgSecondary,
    borderBottom: `1px solid ${vars.color.border}`,
    color: vars.color.textPrimary,
  },
]);

export const embedHeaderTitle = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.9rem',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const embedHeaderIcon = style({
  color: vars.color.textMuted,
  flexShrink: 0,
});

export const pipNav = style([
  chromeBar,
  {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40px',
    cursor: 'grab',
    backgroundColor: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(6px)',
    color: '#fff',
    ':active': {
      cursor: 'grabbing',
    },
  },
]);

export const pipNavTitle = style([
  embedHeaderTitle,
  {
    cursor: 'grab',
    color: '#fff',
    ':active': {
      cursor: 'grabbing',
    },
  },
]);

export const dragOverlay = style({
  position: 'absolute',
  inset: 0,
  zIndex: 70,
  cursor: 'ns-resize',
  userSelect: 'none',
});

export const resizeBar = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '6px',
  cursor: 'ns-resize',
  // The drag is a touch gesture too; keep the browser from scrolling instead.
  touchAction: 'none',
  zIndex: 65,
  backgroundColor: vars.color.bgSecondary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '@media': {
    // A thicker grip so a finger can find it.
    '(max-width: 768px)': {
      height: '22px',
    },
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

export const joiningOverlay = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.35)',
  color: '#fff',
  fontSize: '14px',
  zIndex: 55,
  pointerEvents: 'none',
});

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

export const joiningSpinner = style({
  width: '18px',
  height: '18px',
  marginRight: '8px',
  border: '2px solid rgba(255,255,255,0.3)',
  borderTopColor: '#fff',
  borderRadius: '50%',
  animationName: spin,
  animationDuration: '0.8s',
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
});
