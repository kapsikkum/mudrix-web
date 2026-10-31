import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';
import { fontSize } from '@/theme/typeScale';

export const hero = style({
  display: 'flex',
  alignItems: 'center',
  gap: '18px',
  paddingBottom: '20px',
  marginBottom: '20px',
  borderBottom: `1px solid ${vars.color.border}`,
});

export const heroInfo = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '10px',
});

export const nameRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
});

export const appName = style({
  fontSize: fontSize.rem140,
  fontWeight: 700,
  lineHeight: 1.2,
  color: vars.color.textPrimary,
});

export const versionTag = style({
  fontSize: fontSize.rem75,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  color: vars.color.textMuted,
});

export const heroActions = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '10px',
});

export const sourceBtn = style({
  display: 'inline-flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  gap: '8px',
  // Links and buttons start from different line heights; the same box keeps them one height.
  minHeight: '34px',
  lineHeight: 1.25,
  padding: '6px 14px',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgTertiary,
  color: vars.color.textPrimary,
  cursor: 'pointer',
  textDecoration: 'none',
  fontFamily: vars.font.body,
  fontSize: fontSize.rem85,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  transition: `border-color ${fast}, background-color ${fast}`,
  ':hover': { borderColor: vars.color.accent, textDecoration: 'none' },
});

export const downloadBtn = style([
  sourceBtn,
  {
    backgroundColor: vars.color.accent,
    borderColor: vars.color.accent,
    color: '#fff',
    selectors: {
      '&:hover': {
        backgroundColor: vars.color.accentHover,
        borderColor: vars.color.accentHover,
      },
    },
  },
]);
