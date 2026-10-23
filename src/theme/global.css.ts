import { globalStyle, keyframes } from '@vanilla-extract/css';
import { vars } from './vars.css';

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

globalStyle('.icon-spin', {
  animation: `${spin} 1s linear infinite`,
});

// Safe-area insets go through variables so a native shell that fails to report them (iOS webview
// under the Dynamic Island) can be given a fallback from script; see applyIosSafeAreaFallback.
globalStyle(':root', {
  vars: {
    '--safe-top': 'env(safe-area-inset-top)',
    '--safe-right': 'env(safe-area-inset-right)',
    '--safe-bottom': 'env(safe-area-inset-bottom)',
    '--safe-left': 'env(safe-area-inset-left)',
  },
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

// Phone shell: sized to the visual viewport (--vvw/--vvh from desktop.ts, which also keeps the page
// scrolled to the top) so the keyboard or a stray drag can't pan, shift or bounce it.
globalStyle('html.tauri-mobile', {
  position: 'fixed',
  top: 0,
  left: 0,
  width: 'var(--vvw, 100%)',
  height: 'var(--vvh, 100%)',
  overscrollBehavior: 'none',
});
globalStyle('html.tauri-mobile body', {
  position: 'absolute',
  inset: 0,
  overscrollBehavior: 'none',
});

// The interface is not selectable text (dragging across it or double-clicking would highlight
// buttons, emoji and labels). Text you can reasonably want to copy opts back in.
globalStyle('html', { userSelect: 'none', WebkitUserSelect: 'none' });
globalStyle(
  'input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"], pre, code, [data-selectable], [data-selectable] *',
  { userSelect: 'text', WebkitUserSelect: 'text' }
);
