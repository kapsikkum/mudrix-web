import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const membersSidebar = style({
  width: '220px',
  backgroundColor: vars.color.bgSecondary,
  borderLeft: `1px solid ${vars.color.border}`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  flexShrink: 0,
  '@media': {
    '(max-width: 1100px)': {
      display: 'none',
    },
  },
});

export const membersSidebarTitle = style({
  padding: '12px',
  fontSize: '1rem',
  fontWeight: 700,
  color: vars.color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: `1px solid ${vars.color.border}`,
});

export const membersList = style({
  flex: 1,
  overflowY: 'auto',
  padding: '4px 0',
});
