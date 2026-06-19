import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const avatarWrap = style({
  position: 'relative',
  display: 'inline-flex',
  flexShrink: 0,
  lineHeight: 0,
});

export const avatarWrapFill = style([
  avatarWrap,
  {
    width: '100%',
    height: '100%',
    flexShrink: 1,
  },
]);

export const avatar = style({
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1rem',
  fontWeight: 600,
  color: '#fff',
  flexShrink: 0,
  overflow: 'hidden',
  userSelect: 'none',
});

export const avatarXs = style([avatar, { width: '20px', height: '20px', fontSize: '0.6rem' }]);
export const avatarSm = style([avatar, { width: '28px', height: '28px', fontSize: '0.75rem' }]);
export const avatarLg = style([avatar, { width: '56px', height: '56px', fontSize: '1.4rem' }]);
export const avatarXl = style([avatar, { width: '80px', height: '80px', fontSize: '2rem' }]);

// fill: used inside space buttons — stretches to 100% of parent and inherits
// border-radius so it transitions cleanly between circle and rounded-square.
export const avatarFill = style([
  avatar,
  {
    width: '100%',
    height: '100%',
    fontSize: '1rem',
    borderRadius: 'inherit',
  },
]);

export const avatarImg = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: 'inherit',
});

const presenceDotBase = style({
  position: 'absolute',
  borderRadius: '50%',
  boxSizing: 'border-box',
  border: `2px solid ${vars.color.bgSecondary}`,
  pointerEvents: 'none',
});

export const presenceDotXs = style([
  presenceDotBase,
  {
    width: '6px',
    height: '6px',
    bottom: '-1px',
    right: '-1px',
  },
]);

export const presenceDotSm = style([
  presenceDotBase,
  {
    width: '8px',
    height: '8px',
    bottom: '-1px',
    right: '-1px',
  },
]);

export const presenceDotMd = style([
  presenceDotBase,
  {
    width: '10px',
    height: '10px',
    bottom: '0px',
    right: '0px',
  },
]);

export const presenceDotLg = style([
  presenceDotBase,
  {
    width: '12px',
    height: '12px',
    bottom: '1px',
    right: '1px',
  },
]);

export const presenceDotXl = style([
  presenceDotBase,
  {
    width: '14px',
    height: '14px',
    bottom: '2px',
    right: '2px',
  },
]);

export const presenceDotFill = style([
  presenceDotBase,
  {
    width: '10px',
    height: '10px',
    bottom: '0px',
    right: '0px',
  },
]);

export const presenceOnline = style({ backgroundColor: '#4ade80' });
export const presenceUnavailable = style({ backgroundColor: '#facc15' });
export const presenceOffline = style({ backgroundColor: '#6b7280' });
