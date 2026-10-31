import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { fontSize } from '@/theme/typeScale';

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

export const dangerIcon = style({
  color: vars.color.danger,
});

export const packCardInfo = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

export const packCardName = style({
  fontSize: fontSize.rem95,
  fontWeight: 600,
  color: vars.color.textPrimary,
});

export const packCardMeta = style({
  fontSize: fontSize.rem78,
  color: vars.color.textMuted,
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
});

export const badge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: fontSize.rem72,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '10px',
  backgroundColor: vars.color.bgHover,
  color: vars.color.textMuted,
  textTransform: 'capitalize',
});

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
  fontSize: fontSize.rem85,
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
  fontSize: fontSize.rem110,
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
  fontSize: fontSize.rem76,
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
    [`${imageCard}:hover &:not(:disabled)`]: { opacity: 1 },
    '&:disabled': { opacity: 0, cursor: 'not-allowed' },
  },
});

export const packIconButton = style({
  width: '56px',
  height: '56px',
  borderRadius: '50%',
  border: `1px dashed ${vars.color.border}`,
  backgroundColor: vars.color.bgInput,
  color: vars.color.textMuted,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  overflow: 'hidden',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
  ':hover': { borderColor: vars.color.accent },
});

export const packIconImg = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const actions = style({
  display: 'flex',
  gap: '8px',
  marginTop: '8px',
});
