import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { PANEL_OVERLAY_QUERY } from '@/const/breakpoints';
import { fast } from '@/theme/animations.css';
import { fontSize } from '@/theme/typeScale';

export const panel = style({
  width: '400px',
  maxHeight: '520px',
  display: 'flex',
  flexDirection: 'column',
  '@media': {
    [PANEL_OVERLAY_QUERY]: {
      width: '100% !important',
      maxHeight: '70dvh',
    },
  },
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '2px 4px 8px',
  fontSize: fontSize.rem95,
  fontWeight: 700,
  color: vars.color.textPrimary,
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const headerIcon = style({ color: vars.color.accent, flexShrink: 0 });

export const list = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  paddingTop: '6px',
});

export const empty = style({
  padding: '28px 12px',
  textAlign: 'center',
  color: vars.color.textMuted,
  fontSize: fontSize.rem82,
});

export const item = style({
  position: 'relative',
  display: 'flex',
  gap: '10px',
  padding: '8px',
  borderRadius: vars.radius.sm,
  ':hover': { backgroundColor: vars.color.bgTertiary },
});

export const body = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
});

export const meta = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
  minWidth: 0,
});

export const sender = style({
  fontSize: fontSize.rem85,
  fontWeight: 600,
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const time = style({
  flexShrink: 0,
  fontSize: fontSize.rem72,
  color: vars.color.textMuted,
});

export const text = style({
  fontSize: fontSize.rem85,
  color: vars.color.textSecondary,
  lineHeight: 1.45,
  wordBreak: 'break-word',
  display: '-webkit-box',
  WebkitLineClamp: 4,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

export const textMuted = style([text, { fontStyle: 'italic', color: vars.color.textMuted }]);

export const mediaRow = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '4px',
  maxWidth: '100%',
  fontSize: fontSize.rem85,
  color: vars.color.textSecondary,
});

export const mediaWrap = style({
  display: 'inline-flex',
  maxWidth: '100%',
  borderRadius: vars.radius.sm,
  overflow: 'hidden',
});

export const media = style({
  display: 'block',
  maxWidth: '100%',
  maxHeight: '180px',
  width: 'auto',
  height: 'auto',
  borderRadius: vars.radius.sm,
  objectFit: 'contain',
});

export const actions = style({
  position: 'absolute',
  top: '6px',
  right: '6px',
  display: 'flex',
  gap: '2px',
  padding: '2px 3px',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgSecondary,
  opacity: 0,
  transition: `opacity ${fast}`,
  selectors: {
    [`${item}:hover &, ${item}:has(:focus-visible) &`]: { opacity: 1 },
  },
  '@media': { '(hover: none)': { opacity: 1 } },
});

export const actionBtn = style({
  width: '26px',
  height: '26px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: vars.radius.sm,
  background: 'none',
  color: vars.color.textMuted,
  cursor: 'pointer',
  transition: `background-color ${fast}, color ${fast}`,
  ':hover': { backgroundColor: vars.color.bgHover, color: vars.color.textPrimary },
  ':disabled': { opacity: 0.5, cursor: 'default' },
});
