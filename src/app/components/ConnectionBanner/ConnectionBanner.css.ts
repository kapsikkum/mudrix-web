import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const banner = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 9000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '8px 48px 8px 16px',
  fontSize: '0.85rem',
  fontWeight: 500,
  backgroundColor: vars.color.error,
  color: '#fff',
  transition: 'transform 0.3s ease, opacity 0.3s ease',
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
