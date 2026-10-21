import { style, globalStyle } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { shimmer } from '@/theme/animations.css';

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  marginTop: '8px',
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgSecondary,
  overflow: 'hidden',
  maxWidth: '360px',
  textDecoration: 'none',
  color: 'inherit',
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});

// Reserved before the image bytes arrive; the aspect ratio comes from the
// preview metadata (inline style) and maxHeight clamps tall images.
export const imageBox = style({
  position: 'relative',
  width: '100%',
  maxHeight: '180px',
  aspectRatio: '1.91 / 1',
  overflow: 'hidden',
  backgroundColor: vars.color.bgTertiary,
});

export const image = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  opacity: 0,
  transition: 'opacity 200ms ease-out',
});

export const imageLoaded = style({
  opacity: 1,
});

// Loading placeholder with roughly the height of a text-only preview card.
export const skeletonCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '8px',
  minHeight: '84px',
  padding: '10px',
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgSecondary,
  maxWidth: '360px',
});

export const skeletonBar = style({
  height: '12px',
  borderRadius: '6px',
  backgroundColor: vars.color.bgTertiary,
  backgroundImage: `linear-gradient(90deg, ${vars.color.bgTertiary} 25%, ${vars.color.bgHover} 50%, ${vars.color.bgTertiary} 75%)`,
  backgroundSize: '800px 100%',
  animationName: shimmer,
  animationDuration: '1.4s',
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
});

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  padding: '8px 10px',
  minWidth: 0,
});

export const title = style({
  fontSize: '13px',
  fontWeight: 600,
  color: vars.color.textPrimary,
  textDecoration: 'none',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  lineHeight: '1.35',
  ':hover': {
    textDecoration: 'none',
  },
});

export const description = style({
  fontSize: '12px',
  color: vars.color.textSecondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  lineHeight: '1.4',
});

export const siteName = style({
  fontSize: '11px',
  color: vars.color.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginTop: '2px',
});

globalStyle(`${card} a`, {
  textDecoration: 'none',
});
globalStyle(`${card} a:hover`, {
  textDecoration: 'none',
});

export const ytCard = style([
  card,
  {
    maxWidth: '400px',
    ':hover': { backgroundColor: vars.color.bgSecondary },
  },
]);

export const ytPlayer = style({
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  backgroundColor: '#000',
  overflow: 'hidden',
});

export const ytThumb = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const ytFrame = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  border: 'none',
});

export const ytPlay = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '56px',
  height: '56px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: 'rgba(0,0,0,0.65)',
  color: '#fff',
  cursor: 'pointer',
  transition: 'background-color 120ms, transform 120ms',
  ':hover': { backgroundColor: '#ff0033', transform: 'translate(-50%, -50%) scale(1.06)' },
});

export const ytConsent = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '12px',
  backgroundColor: 'rgba(0,0,0,0.78)',
  color: '#fff',
  textAlign: 'center',
});

export const ytConsentText = style({
  margin: 0,
  fontSize: '12px',
  lineHeight: 1.4,
  maxWidth: '320px',
});

export const ytConsentActions = style({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '6px',
});

export const ytBtn = style({
  padding: '5px 10px',
  borderRadius: vars.radius.sm,
  border: '1px solid rgba(255,255,255,0.3)',
  backgroundColor: 'transparent',
  color: '#fff',
  fontSize: '12px',
  cursor: 'pointer',
  ':hover': { backgroundColor: 'rgba(255,255,255,0.15)' },
});

export const ytBtnPrimary = style([
  ytBtn,
  { backgroundColor: vars.color.accent, borderColor: 'transparent' },
]);
