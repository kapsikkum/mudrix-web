import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const notice = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  backgroundColor: vars.color.bgTertiary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  padding: '12px 14px',
});

export const noticeIcon = style({
  marginTop: '2px',
  flexShrink: 0,
  color: vars.color.textSecondary,
});

export const noticeText = style({
  margin: 0,
  color: vars.color.textPrimary,
});
