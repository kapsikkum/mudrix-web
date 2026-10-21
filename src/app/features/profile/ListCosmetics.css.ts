import { style } from '@vanilla-extract/css';

/**
 * Nameplate behind a whole list row (Discord style): a palette wash with the artwork fading in
 * from the right. The row must be `position: relative; isolation: isolate`.
 */
export const listNameplate = style({
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  borderRadius: 'inherit',
  overflow: 'hidden',
  pointerEvents: 'none',
});

export const listNameplateImg = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'right center',
  maxWidth: 'none',
  userSelect: 'none',
  WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 55%)',
  maskImage: 'linear-gradient(90deg, transparent 0%, #000 55%)',
});

export const listDecorated = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

/** Same 120% overlay as the profile card, centred over the avatar; never takes pointer events. */
export const listDecoration = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '120%',
  height: '120%',
  maxWidth: 'none',
  maxHeight: 'none',
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 1,
});
