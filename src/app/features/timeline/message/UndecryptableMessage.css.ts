import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  alignItems: 'flex-start',
  maxWidth: '520px',
  padding: '8px 10px',
  borderRadius: vars.radius.md,
  border: `1px dashed ${vars.color.border}`,
  backgroundColor: `color-mix(in srgb, ${vars.color.bgSecondary} 70%, transparent)`,
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '4px 10px',
});

export const title = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontStyle: 'italic',
  fontSize: '0.85rem',
  color: vars.color.textMuted,
});

export const headerActions = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  flexWrap: 'wrap',
});

export const reason = style({
  fontSize: '0.78rem',
  lineHeight: '1.45',
  color: vars.color.textMuted,
});

export const help = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '8px',
  paddingTop: '6px',
  borderTop: `1px solid ${vars.color.border}`,
  width: '100%',
});

export const helpText = style({
  fontSize: '0.8rem',
  lineHeight: '1.5',
  color: vars.color.textSecondary,
});

export const helpActions = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px',
});

/** "This device can't read earlier messages" notice at the top of the timeline. */
export const historyNotice = style([
  root,
  {
    alignSelf: 'center',
    flexShrink: 0,
    width: 'calc(100% - 32px)',
    margin: '12px 16px',
  },
]);

export const historyNoticeTitle = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: vars.color.textSecondary,
});

export const progress = style({
  fontSize: '0.78rem',
  color: vars.color.textMuted,
});

/**
 * Placeholder of a message folded into the "N messages couldn't be decrypted" row of its run.
 * It renders nothing itself; the timeline row that contains it is hidden so no avatar/name of an
 * unreadable message is left behind.
 */
export const foldedMarker = style({
  display: 'none',
});

globalStyle('[data-event-id]:has([data-undecryptable-folded])', {
  display: 'none',
});
