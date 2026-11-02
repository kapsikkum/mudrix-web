import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

/** A misspelled word in the composer. */
export const misspelled = style({
  textDecoration: 'underline wavy',
  textDecorationColor: vars.color.danger,
  textUnderlineOffset: '2px',
});
