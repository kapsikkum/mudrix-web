import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const popover = style({
  position: 'fixed',
  zIndex: 9000,
  minWidth: '220px',
  maxWidth: '320px',
  maxHeight: '360px',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

export const popoverMatchWidth = style({
  minWidth: 0,
  maxWidth: 'none',
  width: 'max-content',
});

export const popoverContentWidth = style({
  minWidth: 0,
  maxWidth: 'none',
  width: 'max-content',
});

export const popoverDense = style({
  padding: '4px',
  gap: '2px',
});

export const sheetBackdrop = style({
  position: 'fixed',
  inset: 0,
  zIndex: 8999,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
});

// Bottom sheet used instead of a floating popover on phones. The sheet wins over any inline
// position because the positioning code is skipped in this mode.
export const popoverSheet = style({
  left: 0,
  right: 0,
  bottom: 0,
  top: 'auto',
  width: 'auto',
  minWidth: 0,
  maxWidth: 'none',
  maxHeight: '80dvh',
  borderRadius: '20px 20px 0 0',
  borderBottom: 'none',
  padding: '8px 12px calc(12px + var(--safe-bottom))',
  boxShadow: '0 -8px 32px rgba(0,0,0,0.45)',
});

export const sheetHandle = style({
  width: '40px',
  height: '4px',
  borderRadius: '2px',
  backgroundColor: vars.color.border,
  alignSelf: 'center',
  flexShrink: 0,
  margin: '4px 0 8px',
});

// Finger-sized rows in the sheet.
globalStyle(
  `${popoverSheet} [role='option'], ${popoverSheet} [role='menuitem'], ${popoverSheet} [role='menuitemradio']`,
  {
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
  }
);
