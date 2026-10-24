import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const intro = style({
  color: vars.color.textMuted,
  lineHeight: 1.5,
  margin: '0 0 16px',
});

export const options = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '12px',
});

const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '12px',
  borderRadius: vars.radius.md,
  border: `2px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgSecondary,
  color: vars.color.textPrimary,
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
});

export const option = style([
  card,
  {
    selectors: {
      '&:hover': { borderColor: vars.color.textMuted },
      '&:focus-visible': { outline: `2px solid ${vars.color.accent}`, outlineOffset: '2px' },
    },
  },
]);

export const optionSelected = style([card, { borderColor: vars.color.accent }]);

export const optionTitle = style({ fontWeight: 700 });

export const optionNote = style({ color: vars.color.textMuted, fontSize: '0.85rem' });

export const preview = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '8px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.bgPrimary,
  fontSize: '0.9rem',
  pointerEvents: 'none',
});

export const previewRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '24px',
  color: vars.color.textMuted,
});

export const previewAvatar = style({
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
  flexShrink: 0,
});

export const previewIcon = style({ width: '22px', textAlign: 'center', flexShrink: 0 });

export const footerNote = style({
  color: vars.color.textMuted,
  fontSize: '0.85rem',
  margin: 0,
});
