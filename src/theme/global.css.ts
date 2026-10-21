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

globalStyle('*', {
  scrollbarWidth: 'thin',
  scrollbarColor: `${vars.color.border} transparent`,
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
  border: '1px solid transparent',
  backgroundClip: 'content-box',
});

globalStyle('::-webkit-scrollbar-thumb:hover', {
  background: vars.color.accent,
});

globalStyle('::selection', {
  backgroundColor: vars.color.accent,
  color: '#fff',
});

globalStyle('a', {
  color: vars.color.accent,
});

globalStyle('a:hover', {
  textDecoration: 'underline',
});

globalStyle('html.reduce-motion *, html.reduce-motion *::before, html.reduce-motion *::after', {
  animationDuration: '0.01ms !important',
  animationIterationCount: '1 !important',
  transitionDuration: '0.01ms !important',
  transitionDelay: '0ms !important',
});

globalStyle('html.reduce-motion', {
  scrollBehavior: 'auto',
});

// The app fills the window and never scrolls as a page. `clip` (unlike `hidden`) also blocks
// programmatic scrolling, so a focused or scrollIntoView'd popup cannot push the title bar and
// window buttons off the top of the window.
globalStyle('html, body', {
  overflow: 'clip',
});
globalStyle('#root', {
  overflow: 'clip',
});
