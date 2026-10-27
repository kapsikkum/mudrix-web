import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const note = style({
  margin: '0 0 8px',
  fontSize: '0.85rem',
  color: vars.color.textMuted,
});

export const programList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  marginTop: '10px',
  maxHeight: '320px',
  overflowY: 'auto',
});

export const programRow = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '1px',
  width: '100%',
  padding: '8px 10px',
  border: 'none',
  borderRadius: vars.radius.sm,
  background: 'transparent',
  color: vars.color.textPrimary,
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:hover': { backgroundColor: vars.color.bgHover },
  },
});

export const programExe = style({
  fontSize: '0.9rem',
  fontWeight: 600,
});

export const programTitle = style({
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '0.78rem',
  color: vars.color.textMuted,
});
