import { globalStyle, keyframes } from '@vanilla-extract/css';
import { vars } from './vars.css';

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

globalStyle('.icon-spin', {
  animation: `${spin} 1s linear infinite`,
});

globalStyle('html', {
  fontSize: '16px',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
});

globalStyle('body', {
  fontFamily: vars.font.body,
  color: vars.color.textPrimary,
  backgroundColor: vars.color.bgPrimary,
  lineHeight: '1.5',
});

globalStyle('#root', {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

globalStyle('::-webkit-scrollbar', {
  width: '6px',
  height: '6px',
});

globalStyle('::-webkit-scrollbar-track', {
  background: 'transparent',
});

globalStyle('::-webkit-scrollbar-thumb', {
  background: vars.color.border,
  borderRadius: '3px',
});

globalStyle('::-webkit-scrollbar-thumb:hover', {
  background: vars.color.textSecondary,
});

globalStyle('::selection', {
  backgroundColor: vars.color.accent,
  color: '#fff',
});

globalStyle('a:hover', {
  color: vars.color.accent,
});
