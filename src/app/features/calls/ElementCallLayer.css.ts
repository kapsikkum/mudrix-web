import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const embedContainer = style({
  position: 'relative',
  width: '100%',
  flexShrink: 0,
  height: 0,
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
  transition: 'height 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms ease',
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
});

export const embedHeader = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '0 12px',
  zIndex: 70,
  backgroundColor: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(6px)',
  color: '#fff',
  pointerEvents: 'auto',
  userSelect: 'none',
});

export const embedHeaderTitle = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.85rem',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const embedHeaderBtn = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  border: 'none',
  borderRadius: '6px',
  background: 'rgba(255,255,255,0.14)',
  color: '#fff',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.15s ease',
  ':hover': {
    background: 'rgba(255,255,255,0.28)',
  },
});

export const pipNav = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '0 12px',
  cursor: 'grab',
  zIndex: 70,
  backgroundColor: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(6px)',
  color: '#fff',
  userSelect: 'none',
  ':active': {
    cursor: 'grabbing',
  },
});

export const pipNavTitle = style([
  embedHeaderTitle,
  {
    cursor: 'grab',
    ':active': {
      cursor: 'grabbing',
    },
  },
]);

export const pipNavBtn = style([embedHeaderBtn]);

export const resizeBar = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '6px',
  cursor: 'ns-resize',
  zIndex: 65,
  backgroundColor: vars.color.bgSecondary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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
