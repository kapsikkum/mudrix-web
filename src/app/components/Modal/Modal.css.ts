import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  zIndex: 7000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const dialogBase = style({
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '90vh',
  overflow: 'hidden',
  width: '100%',
});

export const sizes = styleVariants({
  sm: [dialogBase, { maxWidth: '380px' }],
  md: [dialogBase, { maxWidth: '460px' }],
  lg: [dialogBase, { maxWidth: '520px' }],
  xl: [dialogBase, { maxWidth: '640px' }],
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const title = style({
  fontSize: '1.1rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
});

export const body = style({
  padding: '20px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  overflowY: 'auto',
  flex: 1,
});

export const footer = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 24px 20px',
  flexShrink: 0,
});
