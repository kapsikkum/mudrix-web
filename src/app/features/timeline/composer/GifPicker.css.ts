import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const popoverNaked = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
});

export const popover = style({
  width: '360px',
  height: '440px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 5000,
});

export const searchWrap = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '8px 8px 0',
  flexShrink: 0,
});

export const searchInner = style({
  position: 'relative',
  flex: 1,
  minWidth: 0,
});

export const searchInput = style({
  width: '100%',
  padding: '6px 28px 6px 10px',
  backgroundColor: vars.color.bgPrimary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  color: vars.color.textPrimary,
  fontSize: '0.85rem',
  outline: 'none',
  '::placeholder': { color: vars.color.textMuted },
  ':focus': { borderColor: vars.color.accent },
  boxSizing: 'border-box',
});

export const searchClearBtn = style({
  position: 'absolute',
  right: '2px',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '22px',
  height: '22px',
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: 1,
  },
});

export const gridWrap = style({
  flex: 1,
  overflowY: 'auto',
  padding: '0 8px 8px',
});

export const grid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '6px',
  paddingTop: '6px',
});

export const gifItem = style({
  width: '100%',
  aspectRatio: '1',
  overflow: 'hidden',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  background: 'none',
  ':hover': { opacity: 0.85 },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

export const gifImg = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

export const loadingState = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 0',
  color: vars.color.textMuted,
});

export const emptyState = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 0',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
});

export const sectionLabel = style({
  fontSize: '0.82rem',
  fontWeight: 600,
  color: vars.color.textMuted,
  letterSpacing: '0.05em',
  padding: '8px 0 4px',
});
