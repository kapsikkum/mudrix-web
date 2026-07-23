import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export const packList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  marginBottom: '16px',
});

export const packCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
});

export const packCardInfo = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

export const packCardName = style({
  fontSize: '0.95rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const packCardMeta = style({
  fontSize: '0.78rem',
  color: vars.color.textMuted,
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
});

export const badge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '0.72rem',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '10px',
  backgroundColor: vars.color.bgHover,
  color: vars.color.textMuted,
  textTransform: 'capitalize',
});

export const badgeSticker = style([
  {
    backgroundColor: 'rgba(88, 101, 242, 0.15)',
    color: '#5865f2',
  },
]);

export const badgeEmoji = style([
  {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    color: '#eab308',
  },
]);

export const packCardPreview = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  flexShrink: 0,
  marginRight: '12px',
});

export const packCardPreviewImg = style({
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  objectFit: 'cover',
  flexShrink: 0,
});

export const packCardPreviewOverflow = style({
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.65rem',
  fontWeight: 700,
  color: vars.color.textMuted,
  backgroundColor: vars.color.bgTertiary,
  flexShrink: 0,
});

export const packCardActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  flexShrink: 0,
});

export const emptyPacks = style({
  padding: '20px',
  textAlign: 'center',
  color: vars.color.textMuted,
  fontSize: '0.85rem',
  backgroundColor: vars.color.bgSecondary,
  border: `1px dashed ${vars.color.border}`,
  borderRadius: vars.radius.md,
  fontStyle: 'italic',
  marginBottom: '16px',
});

export const editorSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  marginBottom: '20px',
});

export const editorTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '1.1rem',
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const imageGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: '10px',
  marginTop: '4px',
});

export const imageCard = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  padding: '10px',
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  position: 'relative',
});

export const imagePreview = style({
  width: '56px',
  height: '56px',
  borderRadius: vars.radius.sm,
  objectFit: 'contain',
  backgroundColor: vars.color.bgTertiary,
});

export const imageShortcode = style({
  fontSize: '0.76rem',
  color: vars.color.textPrimary,
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  textAlign: 'center',
});

export const imageRemoveBtn = style({
  position: 'absolute',
  top: '4px',
  right: '4px',
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'rgba(0,0,0,0.5)',
  color: '#fff',
  cursor: 'pointer',
  opacity: 0,
  transition: 'opacity 0.15s',
  selectors: {
    [`${imageCard}:hover &`]: { opacity: 1 },
  },
});

export const actions = style({
  display: 'flex',
  gap: '8px',
  marginTop: '8px',
});

export const toggleRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  flexWrap: 'wrap',
});

export const toggleLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.88rem',
  color: vars.color.textPrimary,
  cursor: 'pointer',
});

export const pickerGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '8px',
  padding: '12px',
  overflowY: 'auto',
  flex: 1,
});

export const pickerItem = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  ':hover': { backgroundColor: vars.color.bgHover },
});

export const pickerImage = style({
  width: '48px',
  height: '48px',
  objectFit: 'contain',
});
