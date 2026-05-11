import { style } from '@vanilla-extract/css';

export const pickerWrap = style({
  position: 'fixed',
  zIndex: 9000,
  filter: 'drop-shadow(0 8px 24px rgba(0, 0, 0, 0.45))',
});
