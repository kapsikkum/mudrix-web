import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fontSize } from '@/theme/typeScale';

export const metaRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: fontSize.rem85,
});

export const metaLabel = style({
  color: vars.color.textMuted,
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

export const metaValue = style({
  color: vars.color.textPrimary,
  backgroundColor: vars.color.bgTertiary,
  padding: '2px 6px',
  borderRadius: vars.radius.sm,
  fontSize: fontSize.rem80,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
});

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
});

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

export const sectionTitle = style({
  fontSize: fontSize.rem85,
  fontWeight: 600,
  color: vars.color.textSecondary,
});

export const jsonBlock = style({
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  padding: '12px',
  fontSize: fontSize.rem75,
  lineHeight: 1.4,
  color: vars.color.textPrimary,
  overflow: 'auto',
  maxHeight: '300px',
  margin: 0,
  whiteSpace: 'pre',
  fontFamily: 'monospace',
});
