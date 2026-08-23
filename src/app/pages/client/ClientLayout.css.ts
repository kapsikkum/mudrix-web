import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { med } from '@/theme/animations.css';

export const appShell = style({
  display: 'flex',
  height: '100vh',
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: vars.color.bgPrimary,
  fontFamily: vars.font.body,
  color: vars.color.textPrimary,
  padding:
    'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
});

export const sidebar = style({
  display: 'flex',
  flexShrink: 0,
  height: '100%',
  overflow: 'hidden',
  '@media': {
    '(max-width: 768px)': {
      position: 'fixed',
      left: 'env(safe-area-inset-left)',
      top: 'env(safe-area-inset-top)',
      bottom: 'env(safe-area-inset-bottom)',
      zIndex: 5000,
      transform: 'translateX(-100%)',
      transition: `transform ${med} ease`,
    },
  },
});

export const sidebarOpen = style({
  '@media': {
    '(max-width: 768px)': {
      transform: 'translateX(0)',
    },
  },
});

export const mainContent = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: vars.color.bgSecondary,
});

export const welcomeHome = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: '16px',
  padding: '0 24px',
  textAlign: 'center',
  color: vars.color.textMuted,
  '@media': {
    '(max-width: 768px)': {
      padding: '0 16px',
    },
  },
});

export const welcomeTitle = style({
  color: vars.color.textPrimary,
  fontSize: '1.5rem',
  fontWeight: 700,
});

export const welcomeActions = style({
  display: 'flex',
  gap: '12px',
  marginTop: '8px',
  '@media': {
    '(max-width: 480px)': {
      flexDirection: 'column',
      width: '100%',
    },
  },
});

export const iconBefore = style({
  marginRight: '6px',
});

export const threadDrawerOverlay = style({
  display: 'none',
  '@media': {
    '(max-width: 768px)': {
      display: 'block',
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 4999,
    },
  },
});

export const membersDrawerOverlay = style({
  display: 'none',
  '@media': {
    '(max-width: 768px)': {
      display: 'block',
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 4999,
    },
  },
});

export const drawerOverlay = style({
  display: 'none',
  '@media': {
    '(max-width: 768px)': {
      display: 'block',
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 4999,
    },
  },
});
