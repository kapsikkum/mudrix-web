import { style, keyframes } from '@vanilla-extract/css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.85)',
  zIndex: 8000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: `${keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })} 0.15s ease`,
});

export const mediaWrap = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '90vw',
  maxHeight: '90vh',
  position: 'relative',
});

export const image = style({
  maxWidth: '90vw',
  maxHeight: '90vh',
  objectFit: 'contain',
  borderRadius: '4px',
  userSelect: 'none',
});

export const imageZoomed = style({
  maxWidth: 'none',
  maxHeight: 'none',
  objectFit: 'none',
});

export const closeBtn = style({
  position: 'fixed',
  top: '16px',
  right: '16px',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: 'rgba(0,0,0,0.5)',
  color: '#fff',
  fontSize: '1.5rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 8001,
  ':hover': {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
});

export const toolbar = style({
  position: 'fixed',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  backgroundColor: 'rgba(0,0,0,0.6)',
  padding: '8px 16px',
  borderRadius: '8px',
  zIndex: 8001,
  color: '#fff',
  fontSize: '14px',
  userSelect: 'none',
});

export const toolbarMeta = style({
  display: 'flex',
  flexDirection: 'column',
  lineHeight: 1.3,
});

export const senderName = style({
  fontWeight: 600,
  fontSize: '13px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '200px',
});

export const imageName = style({
  fontSize: '11px',
  opacity: 0.7,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '200px',
});

export const downloadBtn = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  border: 'none',
  background: 'rgba(255,255,255,0.15)',
  color: '#fff',
  padding: '6px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  textDecoration: 'none',
  ':hover': {
    background: 'rgba(255,255,255,0.25)',
  },
});
