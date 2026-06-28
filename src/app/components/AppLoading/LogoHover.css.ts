import { style } from '@vanilla-extract/css';
import { med } from '@/theme/animations.css';

// Base (resting) fill per polygon — matches logo.svg exactly
// Hover fill = the highlight peak color from the loader (#9B75F0)

const HOVER_FILL = '#9B75F0';
const TRANSITION = `fill ${med} ease`;

export const svg = style({
  cursor: 'default',
  overflow: 'visible', // allow glow filter to bleed outside viewBox
  filter: 'none',
});

const makePolygon = (baseFill: string) =>
  style({
    fill: baseFill,
    transition: TRANSITION,
    ':hover': {
      fill: HOVER_FILL,
      filter: `drop-shadow(0 0 6px ${HOVER_FILL}99)`,
      cursor: 'default',
    },
  });

export const p0 = makePolygon('#6A329F');
export const p1 = makePolygon('#784CC8');
export const p2 = makePolygon('#6A329F');
export const p3 = makePolygon('#784CC8');
export const p4 = makePolygon('#5E3079');
export const p5 = makePolygon('#885EE7');
