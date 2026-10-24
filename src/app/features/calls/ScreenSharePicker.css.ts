import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const tabs = style({
  display: 'flex',
  gap: '4px',
  padding: '3px',
  alignSelf: 'flex-start',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgTertiary,
});

export const tab = style({
  padding: '6px 16px',
  border: 'none',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  fontFamily: vars.font.body,
  fontSize: '0.88rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: `background-color ${fast}, color ${fast}`,
  selectors: {
    '&:hover': { color: vars.color.textPrimary },
    '&:focus-visible': { outline: `2px solid ${vars.color.accent}`, outlineOffset: '1px' },
  },
});

export const tabActive = style({
  backgroundColor: vars.color.bgSecondary,
  color: vars.color.textPrimary,
});

export const listArea = style({
  minHeight: '180px',
  maxHeight: 'min(46vh, 380px)',
  overflowY: 'auto',
  margin: '0 -6px',
  padding: '6px',
});

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
  gap: '10px',
  '@media': {
    '(max-width: 480px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '8px',
    },
  },
});

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  minWidth: 0,
  padding: '6px',
  border: '2px solid transparent',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textPrimary,
  fontFamily: vars.font.body,
  textAlign: 'left',
  cursor: 'pointer',
  transition: `background-color ${fast}, border-color ${fast}`,
  selectors: {
    '&:hover': { backgroundColor: vars.color.bgHover },
    '&:focus-visible': { outline: `2px solid ${vars.color.accent}`, outlineOffset: '2px' },
  },
});

export const cardSelected = style({
  borderColor: vars.color.accent,
  backgroundColor: vars.color.bgActive,
});

export const thumb = style({
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  overflow: 'hidden',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgPrimary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: vars.color.textMuted,
});

export const thumbImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  display: 'block',
});

export const caption = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
  padding: '0 2px 2px',
  fontSize: '0.82rem',
});

export const captionIcon = style({
  width: '16px',
  height: '16px',
  flexShrink: 0,
  objectFit: 'contain',
  display: 'flex',
  alignItems: 'center',
  color: vars.color.textMuted,
});

export const captionText = style({
  minWidth: 0,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const badge = style({
  flexShrink: 0,
  padding: '1px 6px',
  borderRadius: '999px',
  backgroundColor: vars.color.bgPrimary,
  color: vars.color.textMuted,
  fontSize: '0.7rem',
  fontWeight: 600,
});

export const status = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '160px',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
  textAlign: 'center',
});

export const options = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: '12px 20px',
});

export const optionSelect = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: '130px',
  flex: '1 1 130px',
});

export const optionLabel = style({
  color: vars.color.textMuted,
  fontSize: '0.78rem',
  fontWeight: 600,
});

export const optionToggle = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '36px',
  fontSize: '0.88rem',
  color: vars.color.textPrimary,
});

export const optionToggleLabel = style({
  cursor: 'pointer',
  userSelect: 'none',
});
