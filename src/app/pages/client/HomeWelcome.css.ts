import { globalStyle, keyframes, style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

/** Phones: everything stacks and fills the width. */
const PHONE = '(max-width: 480px)';
/** Touch screens get bigger targets; a keyboard tip means nothing there. */
const TOUCH = '(max-width: 768px), (pointer: coarse)';
const NO_MOTION = '(prefers-reduced-motion: reduce)';

const appear = keyframes({
  from: { opacity: 0, transform: 'translateY(8px)' },
  to: { opacity: 1, transform: 'none' },
});

/** Entrance: each block rises in a beat after the one above it (`--i` is its place in line). */
export const enter = style({
  animation: `${appear} 320ms cubic-bezier(0.2, 0.7, 0.3, 1) both`,
  animationDelay: 'calc(var(--i, 0) * 55ms)',
  '@media': { [NO_MOTION]: { animation: 'none' } },
});

/** The scroll area; the content centres itself in it while it fits. */
export const home = style({
  flex: 1,
  minWidth: 0,
  height: '100%',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  display: 'flex',
  flexDirection: 'column',
  padding: '40px 24px',
  color: vars.color.textPrimary,
  '@media': {
    '(max-width: 768px)': { padding: '28px 16px 24px' },
  },
});

export const inner = style({
  width: '100%',
  maxWidth: '680px',
  margin: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
  containerType: 'inline-size',
  '@media': { [PHONE]: { gap: '28px' } },
});

// ---------- hero ----------

export const hero = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  textAlign: 'center',
});

/** The mound sits on a soft pool of its own colour. */
export const logo = style({
  position: 'relative',
  isolation: 'isolate',
  display: 'flex',
  marginBottom: '10px',
  '::before': {
    content: '""',
    position: 'absolute',
    inset: '-40px',
    zIndex: -1,
    borderRadius: '50%',
    background: `radial-gradient(closest-side, ${vars.logo.hoverGlow}, transparent)`,
    opacity: 0.3,
    filter: 'blur(14px)',
    pointerEvents: 'none',
  },
});

export const title = style({
  fontSize: '1.75rem',
  fontWeight: 700,
  lineHeight: 1.2,
  color: vars.color.textPrimary,
  overflowWrap: 'anywhere',
  '@media': { [PHONE]: { fontSize: '1.5rem' } },
});

export const tagline = style({
  color: vars.color.textMuted,
  fontSize: '0.95rem',
  lineHeight: 1.4,
});

// ---------- sections ----------

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

export const sectionLabel = style({
  fontSize: '0.78rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: vars.color.textMuted,
});

/** One column of wide rows in a narrow pane, three cards side by side once there is room. */
export const grid = style({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: '10px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  '@container': {
    '(min-width: 540px)': { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' },
  },
});

export const gridItem = style({ display: 'flex', minWidth: 0 });

export const card = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  minHeight: '72px',
  padding: '14px 16px',
  borderRadius: vars.radius.lg,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgPrimary,
  color: vars.color.textPrimary,
  font: 'inherit',
  textAlign: 'start',
  cursor: 'pointer',
  transition: 'border-color 150ms, background-color 150ms, transform 150ms, box-shadow 150ms',
  ':hover': {
    borderColor: `rgba(${vars.color.accentRgb}, 0.55)`,
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
  },
  ':active': { transform: 'translateY(1px)' },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
  '@container': {
    '(min-width: 540px)': {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '18px',
    },
  },
  '@media': {
    '(hover: hover) and (prefers-reduced-motion: no-preference)': {
      selectors: { '&:hover': { transform: 'translateY(-2px)' } },
    },
  },
});

export const cardIcon = style({
  flexShrink: 0,
  width: '40px',
  height: '40px',
  borderRadius: vars.radius.md,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: vars.color.accent,
  backgroundColor: `rgba(${vars.color.accentRgb}, 0.14)`,
});

export const cardText = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  minWidth: 0,
});

export const cardTitle = style({
  fontSize: '0.95rem',
  fontWeight: 600,
  lineHeight: 1.3,
  color: vars.color.textPrimary,
});

export const cardDesc = style({
  fontSize: '0.83rem',
  lineHeight: 1.4,
  color: vars.color.textMuted,
});

// ---------- finish setting up ----------

export const setupList = style({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  borderRadius: vars.radius.lg,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgPrimary,
  overflow: 'hidden',
});

export const setupRow = style({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  minHeight: '64px',
  padding: '12px 16px',
  border: 'none',
  background: 'none',
  color: vars.color.textPrimary,
  font: 'inherit',
  textAlign: 'start',
  cursor: 'pointer',
  transition: 'background-color 150ms',
  ':hover': { backgroundColor: vars.color.bgHover },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '-2px',
    borderRadius: vars.radius.lg,
  },
});

globalStyle(`${setupList} > li + li`, {
  borderTop: `1px solid ${vars.color.border}`,
});

export const setupIcon = style([cardIcon, { width: '36px', height: '36px', borderRadius: '50%' }]);
export const setupIconWarning = style({
  color: vars.color.warning,
  backgroundColor: 'transparent',
  boxShadow: `inset 0 0 0 1.5px ${vars.color.warning}`,
});

export const setupText = style([cardText, { flex: 1 }]);

export const chevron = style({
  flexShrink: 0,
  color: vars.color.textMuted,
});

// ---------- keyboard tip ----------

export const hint = style({
  textAlign: 'center',
  fontSize: '0.83rem',
  lineHeight: 1.6,
  color: vars.color.textMuted,
  '@media': { [TOUCH]: { display: 'none' } },
});

export const kbd = style({
  display: 'inline-block',
  margin: '0 2px',
  padding: '1px 6px',
  fontFamily: 'inherit',
  fontSize: '0.75rem',
  lineHeight: 1.5,
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  borderBottomWidth: '2px',
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textPrimary,
});
