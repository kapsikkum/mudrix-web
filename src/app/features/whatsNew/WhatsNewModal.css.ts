import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fast } from '@/theme/animations.css';

export const body = style({
  fontSize: '0.92rem',
  lineHeight: 1.55,
  color: vars.color.textPrimary,
});

// The kind of change (New, Fixed): a title with a rule under it.
globalStyle(`${body} h2`, {
  margin: '24px 0 4px',
  paddingBottom: '6px',
  fontSize: '1.05rem',
  fontWeight: 700,
  color: vars.color.accent,
  borderBottom: `1px solid ${vars.color.border}`,
});

// The area within it (Profiles, Sounds, ...): a small label above its list.
globalStyle(`${body} h3`, {
  margin: '16px 0 6px',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: vars.color.textMuted,
});

globalStyle(`${body} > :first-child`, { marginTop: 0 });

globalStyle(`${body} p`, { margin: '0 0 10px' });

// Bullets hang outside the text, so a wrapped line lines up with the first one.
globalStyle(`${body} ul`, {
  margin: '0 0 6px',
  paddingLeft: '1.3em',
  listStylePosition: 'outside',
  listStyleType: 'disc',
});

globalStyle(`${body} li`, { margin: '0 0 7px', paddingLeft: '2px' });

globalStyle(`${body} li::marker`, { color: vars.color.accent });

globalStyle(`${body} a`, {
  color: vars.color.textPrimary,
  textDecoration: 'underline',
  textDecorationColor: vars.color.textMuted,
  textUnderlineOffset: '2px',
  cursor: 'pointer',
  transition: `text-decoration-color ${fast}`,
});

globalStyle(`${body} a:hover`, { textDecorationColor: vars.color.textPrimary });

globalStyle(`${body} code`, {
  fontSize: '0.85em',
  padding: '1px 4px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgTertiary,
});

export const changelogLink = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  marginRight: 'auto',
  fontSize: '0.82rem',
  color: vars.color.textMuted,
  textDecoration: 'none',
  transition: `color ${fast}`,
  ':hover': { color: vars.color.textPrimary },
});
