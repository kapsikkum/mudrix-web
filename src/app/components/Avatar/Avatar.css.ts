import { style } from '@vanilla-extract/css';

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
