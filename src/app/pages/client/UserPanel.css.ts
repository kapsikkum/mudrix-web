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

export const voiceControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  flexShrink: 0,
});

export const deafenStrike = style({
  position: 'relative',
  display: 'inline-flex',
});

export const deafenStrikeSlash = style({
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: '22px',
  height: '2px',
  transform: 'translate(-50%, -50%) rotate(45deg)',
  pointerEvents: 'none',
});

export const deafenStrikeOutline = style({
  position: 'absolute',
  top: 0,
  left: '1px',
  right: '1px',
  height: '1px',
  borderRadius: '1px',
  background: vars.color.bgSecondary,
});

export const deafenStrikeCore = style({
  position: 'absolute',
  bottom: 0,
  left: '1px',
  right: '1px',
  height: '1px',
  borderRadius: '1px',
  background: 'currentColor',
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
