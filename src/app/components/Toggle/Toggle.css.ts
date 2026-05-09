import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

// Hidden native checkbox
export const nativeInput = style({
  position: 'absolute',
  opacity: 0,
  width: 0,
  height: 0,
  pointerEvents: 'none',
});

// Track (the pill background)
const trackBase = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background-color 0.2s, border-color 0.2s',
});

export const trackSizes = styleVariants({
  sm: [trackBase, { width: '36px', height: '20px' }],
  md: [trackBase, { width: '44px', height: '24px' }],
});

export const trackChecked = style({
  backgroundColor: vars.color.accent,
  borderColor: vars.color.accent,
});

export const trackDisabled = style({
  opacity: 0.5,
  cursor: 'not-allowed',
});

// Thumb (the sliding circle)
const thumbBase = style({
  position: 'absolute',
  borderRadius: '50%',
  backgroundColor: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  transition: 'transform 0.2s',
});

export const thumbSizes = styleVariants({
  sm: [thumbBase, { width: '14px', height: '14px', left: '2px', transform: 'translateX(0)' }],
  md: [thumbBase, { width: '18px', height: '18px', left: '2px', transform: 'translateX(0)' }],
});

export const thumbCheckedSizes = styleVariants({
  sm: { transform: 'translateX(16px)' },
  md: { transform: 'translateX(20px)' },
});

// Row layout for label + toggle
export const row = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: `1px solid ${vars.color.border}`,
  gap: '16px',
});

export const rowInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  flex: 1,
});

export const rowLabel = style({
  fontSize: '0.9rem',
  fontWeight: 500,
  color: vars.color.textPrimary,
});

export const rowDescription = style({
  fontSize: '0.8rem',
  color: vars.color.textMuted,
});
