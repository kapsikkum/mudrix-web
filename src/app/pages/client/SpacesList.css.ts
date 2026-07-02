import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast, med } from '@/theme/animations.css';

export const spacesList = style({
  width: '66px',
  backgroundColor: vars.color.bgPrimary,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: '8px',
  gap: '4px',
  borderRight: `1px solid ${vars.color.border}`,
  flexShrink: 0,
  height: '100%',
});

export const spacesScrollArea = style({
  flex: 1,
  overflowY: 'auto',
  scrollbarWidth: 'none',
  '::-webkit-scrollbar': {
    display: 'none',
  },
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  paddingTop: '2px',
  paddingBottom: '2px',
});

export const spacesStickyBottom = style({
  position: 'sticky',
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  width: '100%',
  backgroundColor: vars.color.bgPrimary,
});

export const spaceBarBtn = style({
  width: '44px',
  height: '44px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  fontSize: '0.9rem',
  fontWeight: 700,
  transition: `border-radius ${med} ease, background-color ${fast}, box-shadow ${fast}`,
  position: 'relative',
  flexShrink: 0,
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textMuted,
  ':hover': {
    borderRadius: vars.radius.md,
    color: vars.color.textPrimary,
  },
});

// Inner button inside a sortable wrapper — visually transparent, just handles clicks
export const spaceBtnInner = style({
  width: '100%',
  height: '100%',
  border: 'none',
  padding: 0,
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  outline: 'none',
});

export const spaceBarBtnActive = style([
  spaceBarBtn,
  {
    borderRadius: vars.radius.md,
    backgroundColor: vars.color.accent,
    color: '#fff',
    ':hover': {
      borderRadius: vars.radius.md,
      backgroundColor: vars.color.accentHover,
      color: '#fff',
    },
  },
]);

export const spacesSeparator = style({
  width: '32px',
  height: '1px',
  backgroundColor: vars.color.border,
  margin: '4px 0',
});

export const spaceBtnActive = style([
  spaceBarBtn,
  {
    borderRadius: vars.radius.md,
    boxShadow: `0 0 0 2px ${vars.color.accent}`,
  },
]);

export const spaceAvatarWrap = style({
  width: '100%',
  height: '100%',
  lineHeight: 0,
  borderRadius: '50%',
  overflow: 'hidden',
  transition: `border-radius ${med} ease`,
  selectors: {
    [`${spaceBarBtn}:hover &`]: {
      borderRadius: vars.radius.md,
    },
    [`${spaceBtnActive} &`]: {
      borderRadius: vars.radius.md,
    },
  },
});

export const inviteBadge = style({
  position: 'absolute',
  top: '1px',
  right: '1px',
  width: '14px',
  height: '14px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `2px solid ${vars.color.bgPrimary}`,
});

export const notifDot = style({
  position: 'absolute',
  bottom: '4px',
  right: '4px',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  border: `2px solid ${vars.color.bgPrimary}`,
});

// Drop target indicator — dotted accent outline around the target item
export const spaceBtnOver = style({
  outline: `2px dotted ${vars.color.accent}`,
  outlineOffset: '2px',
  borderRadius: vars.radius.md,
});

export const spaceBtnDragOverlay = style({
  width: '44px',
  height: '44px',
  borderRadius: vars.radius.md,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  backgroundColor: vars.color.bgTertiary,
  boxShadow: `0 6px 20px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.2)`,
  position: 'relative',
});
