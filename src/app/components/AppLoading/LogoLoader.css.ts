import { style, keyframes } from '@vanilla-extract/css';

// The 6 fill colors that will rotate through the polygons
// Ordered from darkest to brightest: a full rotation means each polygon
// cycles through all 6 shades and loops, creating a counterclockwise sweep.
const c1 = '#5E3079';
const c2 = '#6A329F';
const c3 = '#784CC8';
const c4 = '#885EE7';
const c5 = '#9B75F0'; // highlight peak

// Each polygon cycles through the same color ramp but with a different delay,
// so the "bright peak" travels around the shape counterclockwise.
const colorCycle = keyframes({
  '0%': { fill: c2 },
  '16%': { fill: c4 },
  '33%': { fill: c5 },
  '50%': { fill: c4 },
  '66%': { fill: c3 },
  '83%': { fill: c1 },
  '100%': { fill: c2 },
});

const DURATION = '2.4s';
const TIMING = 'ease-in-out';
const ITER = 'infinite';

// Each polygon gets the same animation but offset by 1/6 of the duration
// (0.4 s per step) so the highlight travels counterclockwise.
const base = {
  animationName: colorCycle,
  animationDuration: DURATION,
  animationTimingFunction: TIMING,
  animationIterationCount: ITER,
} as const;

export const p0 = style({ ...base, animationDelay: '0s' });
export const p1 = style({ ...base, animationDelay: '-0.4s' });
export const p2 = style({ ...base, animationDelay: '-0.8s' });
export const p3 = style({ ...base, animationDelay: '-1.2s' });
export const p4 = style({ ...base, animationDelay: '-1.6s' });
export const p5 = style({ ...base, animationDelay: '-2.0s' });

export const svg = style({
  width: '80px',
  height: '80px',
});
