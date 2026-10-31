import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fontSize } from '@/theme/typeScale';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '16px',
  backgroundColor: vars.color.bgPrimary,
  padding: '2rem',
});

export const errorBox = style({
  maxWidth: '480px',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
});

export const heading = style({
  fontSize: fontSize.rem110,
  fontWeight: 600,
  color: vars.color.textPrimary,
  margin: 0,
});

export const message = style({
  fontSize: fontSize.rem85,
  color: vars.color.textMuted,
  fontFamily: 'monospace',
  backgroundColor: vars.color.bgTertiary,
  padding: '8px 12px',
  borderRadius: vars.radius.sm,
  wordBreak: 'break-word',
  maxWidth: '100%',
});

export const refreshBtn = style({
  padding: '8px 20px',
  borderRadius: vars.radius.md,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: fontSize.rem90,
  backgroundColor: vars.color.accent,
  color: '#fff',
  ':hover': {
    backgroundColor: vars.color.accentHover,
  },
});
