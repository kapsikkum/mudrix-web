import { style } from '@vanilla-extract/css';
import { PANEL_OVERLAY_QUERY, TABLET_QUERY } from '@/const/breakpoints';
import { vars } from '@/theme/vars.css';
import { med } from '@/theme/animations.css';
import { mobileHeader } from './MobileHeader.css';
import { banner } from '@/app/components/ConnectionBanner/ConnectionBanner.css';
import { TITLE_BAR_HEIGHT } from '@/app/components/TitleBar/TitleBar.css';

export const appFrame = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
  backgroundColor: vars.color.bgPrimary,
  selectors: {
    // Fills the phone shell's web view, which Android and the iOS plugin end at the keyboard; older
    // iOS builds set --vvh to the visual viewport so the keyboard shrinks the app instead of panning it.
    'html.tauri-mobile &': { height: 'var(--vvh, 100dvh)' },
  },
});

export const appShell = style({
  display: 'flex',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: vars.color.bgPrimary,
  fontFamily: vars.font.body,
  color: vars.color.textPrimary,
  padding: 'var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)',
  selectors: {
    // The mobile header already clears the top inset.
    [`${mobileHeader} ~ &`]: { paddingTop: 0 },
    // So does the connection banner above it, which clears the inset itself.
    [`${banner} ~ &`]: { paddingTop: 0 },
  },
});

export const sidebar = style({
  display: 'flex',
  flexShrink: 0,
  height: '100%',
  overflow: 'hidden',
  '@media': {
    // Phones and touch tablets: a drawer that slides in over the chat.
    [PANEL_OVERLAY_QUERY]: {
      position: 'fixed',
      left: 'var(--safe-left)',
      top: 'var(--safe-top)',
      bottom: 'var(--safe-bottom)',
      zIndex: 5000,
      transform: 'translateX(-100%)',
      transition: `transform ${med} ease`,
    },
    // Tablets keep the title bar (and its menu button) uncovered.
    [TABLET_QUERY]: {
      top: `calc(var(--safe-top) + ${TITLE_BAR_HEIGHT}px)`,
      height: 'auto',
    },
  },
});

export const sidebarOpen = style({
  '@media': {
    [PANEL_OVERLAY_QUERY]: {
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

export const mainContentHidden = style({
  '@media': {
    '(min-width: 769px)': {
      display: 'none',
    },
  },
});

export const homeLayout = style({
  display: 'flex',
  height: '100%',
  minHeight: 0,
});

export const panelDrawerOverlay = style({
  display: 'none',
  '@media': {
    [PANEL_OVERLAY_QUERY]: {
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
    [PANEL_OVERLAY_QUERY]: {
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
    [PANEL_OVERLAY_QUERY]: {
      display: 'block',
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 4999,
    },
  },
});

// Opens the sidebar drawer; only touch tablets need it (phones have the mobile header, desktops
// keep the sidebar open).
export const titleBarMenuBtn = style({
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '32px',
  border: 'none',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  cursor: 'pointer',
  '@media': {
    [TABLET_QUERY]: { display: 'flex' },
  },
  selectors: {
    '&:active': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
  },
});
