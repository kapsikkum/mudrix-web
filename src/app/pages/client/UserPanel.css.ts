import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const userPanel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 12px',
  borderTop: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgSecondary,
});

export const userPanelId = style({
  fontSize: '0.82rem',
  color: vars.color.textMuted,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const gearWrap = style({
  position: 'relative',
  display: 'flex',
});

export const gearBadge = style({
  position: 'absolute',
  top: '-2px',
  right: '-2px',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  border: `2px solid ${vars.color.bgSecondary}`,
});
