import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { med } from '@/theme/animations.css';

const base = {
  width: '240px',
  backgroundColor: vars.color.bgSecondary,
  borderLeft: `1px solid ${vars.color.border}`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  flexShrink: 0,
  '@media': {
    '(max-width: 768px)': {
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 5000,
      transform: 'translateX(100%)',
      transition: `transform ${med} ease`,
    },
  },
} as const;

export const membersSidebar = style(base);

export const membersSidebarOpen = style({
  ...base,
  '@media': {
    '(max-width: 768px)': {
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 5000,
      transform: 'translateX(0)',
      transition: `transform ${med} ease`,
    },
  },
});

export const membersSidebarClosed = style({
  ...base,
  width: '0px',
  minWidth: '0px',
  flex: '0 0 0px',
  overflow: 'hidden',
  borderLeft: 'none',
  padding: 0,
  '@media': {
    '(max-width: 768px)': {
      width: '240px',
      minWidth: '240px',
      flex: '0 0 auto',
      overflow: 'hidden',
      borderLeft: `1px solid ${vars.color.border}`,
      padding: 'initial',
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 5000,
      transform: 'translateX(100%)',
      transition: `transform ${med} ease`,
    },
  },
});

export const membersSidebarTitle = style({
  padding: '12px',
  fontSize: '1rem',
  fontWeight: 700,
  color: vars.color.textMuted,
  letterSpacing: '0.04em',
  borderBottom: `1px solid ${vars.color.border}`,
});

export const membersList = style({
  flex: 1,
  overflowY: 'auto',
});
