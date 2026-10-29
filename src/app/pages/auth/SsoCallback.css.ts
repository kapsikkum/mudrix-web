import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const errorPanel = style({
  padding: '2rem',
  textAlign: 'center',
  color: vars.color.error,
});
