import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { EMBED_HEADER_HEIGHT } from './ElementCallLayer.css';
import { ringAvatar } from './IncomingCallOverlay.css';

export const screen = style({
  position: 'absolute',
  inset: 0,
  zIndex: 60,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'clamp(12px, 6cqh, 32px)',
  padding: `${EMBED_HEADER_HEIGHT}px 16px 16px`,
  containerType: 'size',
  backgroundColor: vars.color.bgPrimary,
  backgroundImage: `radial-gradient(70% 55% at 50% 115%, ${vars.color.accent} -60%, transparent 70%)`,
  pointerEvents: 'auto',
});

export const callees = style({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '20px',
  maxWidth: '100%',
});

export const calleeAvatar = style([
  ringAvatar,
  {
    width: 'clamp(56px, 30cqmin, 128px)',
    height: 'clamp(56px, 30cqmin, 128px)',
    marginBottom: 0,
    '@media': {
      '(max-width: 768px)': {
        width: 'clamp(56px, 30cqmin, 128px)',
        height: 'clamp(56px, 30cqmin, 128px)',
      },
    },
  },
]);
