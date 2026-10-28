import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { slow } from '@/theme/animations.css';

// Sits at the top of the layout flow, so everything else is pushed below it. Its colour runs under
// the status bar / notch and the text sits below the inset (the app shell drops its own top
// inset while this is showing).
export const banner = style({
  position: 'relative',
  flexShrink: 0,
  width: '100%',
  boxSizing: 'border-box',
  zIndex: 9000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: 'calc(8px + var(--safe-top)) 48px 8px 16px',
  fontSize: '0.85rem',
  fontWeight: 500,
  backgroundColor: vars.color.error,
  color: '#fff',
  transition: `transform ${slow} ease, opacity ${slow} ease`,
});

export const bannerReconnected = style([
  banner,
  {
    backgroundColor: vars.color.success,
  },
]);

export const dismissButton = style({
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  background: 'none',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  padding: '0 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.8,
  selectors: {
    '&:hover': { opacity: 1 },
  },
});
