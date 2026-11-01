import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { zIndex } from '@/theme/zIndex';
import { fontSize } from '@/theme/typeScale';

export const backdrop = style({
  position: 'absolute',
  inset: 0,
  zIndex: zIndex.callPanel,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  backgroundColor: vars.scrim.modal,
  backdropFilter: 'blur(6px)',
});

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '14px',
  width: 'min(340px, 100%)',
  padding: '24px 22px 20px',
  borderRadius: vars.radius.lg,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgSecondary,
  boxShadow: vars.shadow.popup,
  textAlign: 'center',
});

// Shown while the call is popped out or the user is in another room, where there is no call stage
// to cover.
export const floatingCard = style([
  card,
  {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    zIndex: zIndex.alert,
  },
]);

export const copy = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

export const title = style({
  color: vars.color.textPrimary,
  fontSize: fontSize.rem105,
  fontWeight: 700,
});

export const subtitle = style({
  color: vars.color.textMuted,
  fontSize: fontSize.rem88,
  fontVariantNumeric: 'tabular-nums',
});

export const actions = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  width: '100%',
  justifyContent: 'center',
});
