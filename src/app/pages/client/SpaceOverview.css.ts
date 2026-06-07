import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
});

export const scrollArea = style({
  flex: 1,
  overflowY: 'auto',
  padding: '24px 32px',
});

export const spaceHeader = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '12px',
  marginBottom: '32px',
  padding: '16px 0',
});

export const spaceInfo = style({
  textAlign: 'center',
  maxWidth: '100%',
});

export const spaceName = style({
  fontSize: '1.25rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
});

export const spaceTopic = style({
  fontSize: '0.85rem',
  color: vars.color.textMuted,
  marginTop: '4px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
});

export const spaceActions = style({
  display: 'flex',
  gap: '8px',
  flexShrink: 0,
});

export const sectionTitle = style({
  fontSize: '0.95rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

export const roomList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const roomRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  backgroundColor: vars.color.bgPrimary,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.bgHover,
    },
  },
});

export const roomRowDivider = style({
  width: '1px',
  height: '28px',
  backgroundColor: vars.color.border,
  flexShrink: 0,
});

export const roomRowActions = style({
  display: 'flex',
  gap: '4px',
  flexShrink: 0,
});

export const roomInfo = style({
  flex: 1,
  minWidth: 0,
});

export const roomName = style({
  fontSize: '0.95rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const roomMeta = style({
  fontSize: '0.82rem',
  color: vars.color.textMuted,
  marginTop: '2px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const metaDivider = style({
  width: '3px',
  height: '3px',
  borderRadius: '50%',
  backgroundColor: vars.color.textMuted,
  flexShrink: 0,
  opacity: 0.5,
});

export const roomTopicText = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
});

export const memberCount = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  flexShrink: 0,
});

export const emptyState = style({
  padding: '32px 16px',
  textAlign: 'center',
  color: vars.color.textMuted,
  fontSize: '0.9rem',
});

export const sortBtnWrap = style({
  position: 'relative',
  width: '28px',
  height: '28px',
  flexShrink: 0,
  borderRadius: vars.radius.sm,
  ':hover': {
    backgroundColor: vars.color.bgHover,
  },
});

export const sortBtnIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  border: `1px solid transparent`,
  color: vars.color.textMuted,
  pointerEvents: 'none',
});

export const sortSelect = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  border: 'none',
  appearance: 'none',
});
