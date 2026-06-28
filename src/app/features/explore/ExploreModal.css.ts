import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';
import { scaleIn, fast, med } from '@/theme/animations.css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.65)',
  zIndex: 8000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '5vh 5vw',
});

export const dialog = style({
  backgroundColor: vars.color.bgSecondary,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  width: '100%',
  maxWidth: '1000px',
  height: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  animation: `${scaleIn} ${fast} ease`,
  boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
});

export const header = style({
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0',
  padding: '16px 20px 0',
  borderBottom: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgSecondary,
});

export const headerTop = style({
  display: 'flex',
  alignItems: 'center',
  marginBottom: '14px',
});

export const headerTitle = style({
  fontSize: '1rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const headerTitleIcon = style({
  color: vars.color.accent,
  display: 'flex',
  alignItems: 'center',
});

export const closeBtn = style({
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'none',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  color: vars.color.textMuted,
  transition: `background-color ${fast}, color ${fast}`,
  ':hover': {
    backgroundColor: vars.color.bgHover,
    color: vars.color.textPrimary,
  },
});

export const controlsRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  paddingBottom: '12px',
  flexWrap: 'wrap',
});

export const searchFilterSlot = style({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  transition: `opacity ${med} ease, transform ${med} ease, max-width ${med} ease`,
});

export const searchFilterSlotVisible = style([
  searchFilterSlot,
  {
    opacity: 1,
    transform: 'translateX(0)',
    maxWidth: '1000px',
    pointerEvents: 'auto',
  },
]);

export const searchFilterSlotHidden = style([
  searchFilterSlot,
  {
    opacity: 0,
    transform: 'translateX(-18px)',
    maxWidth: '0px',
    pointerEvents: 'none',
  },
]);

export const pillGroup = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  backgroundColor: vars.color.bgPrimary,
  borderRadius: vars.radius.md,
  padding: '3px',
  border: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const pill = style({
  padding: '4px 12px',
  borderRadius: vars.radius.sm,
  border: 'none',
  background: 'none',
  color: vars.color.textMuted,
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: `background-color ${fast}, color ${fast}`,
  whiteSpace: 'nowrap',
  ':hover': {
    color: vars.color.textPrimary,
    backgroundColor: vars.color.bgHover,
  },
});

export const pillActive = style([
  pill,
  {
    backgroundColor: vars.color.accent,
    color: '#fff',
    ':hover': {
      backgroundColor: vars.color.accentHover,
      color: '#fff',
    },
  },
]);

export const pillOtherWrapper = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  borderRadius: vars.radius.sm,
  cursor: 'default',
  transition: `background-color ${fast}`,
});

export const pillOtherWrapperActive = style([
  pillOtherWrapper,
  {
    backgroundColor: vars.color.accent,
  },
]);

export const pillOtherInput = style({
  background: 'none',
  border: 'none',
  outline: 'none',
  color: vars.color.textMuted,
  fontSize: '0.82rem',
  fontWeight: 600,
  // Shrink to just fit the placeholder text when inactive
  width: '34px',
  cursor: 'pointer',
  transition: `width ${med} ease`,
  '::placeholder': {
    color: vars.color.textMuted,
  },
});

export const pillOtherInputActive = style([
  pillOtherInput,
  {
    // Expand to a comfortable typing width when the pill is selected
    width: '120px',
    cursor: 'text',
    color: '#fff',
    '::placeholder': {
      color: 'rgba(255,255,255,0.6)',
    },
  },
]);

export const pillGoBtn = style({
  display: 'flex',
  alignItems: 'center',
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.8)',
  cursor: 'pointer',
  padding: '0',
  ':hover': {
    color: '#fff',
  },
});

export const searchWrapper = style({
  flex: 1,
  minWidth: '160px',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
});

export const searchIcon = style({
  position: 'absolute',
  left: '10px',
  color: vars.color.textMuted,
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
});

export const searchInput = style({
  width: '100%',
  height: '32px',
  paddingLeft: '32px',
  paddingRight: '10px',
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgPrimary,
  color: vars.color.textPrimary,
  fontSize: '0.85rem',
  outline: 'none',
  ':focus': {
    borderColor: vars.color.accent,
  },
  '::placeholder': {
    color: vars.color.textMuted,
  },
});

export const filterSelect = style({
  height: '32px',
  padding: '0 8px',
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgPrimary,
  color: vars.color.textPrimary,
  fontSize: '0.82rem',
  cursor: 'pointer',
  outline: 'none',
  flexShrink: 0,
  ':focus': {
    borderColor: vars.color.accent,
  },
});

export const scrollArea = style({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '20px',
  minWidth: 0,
});

export const sectionTitle = style({
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.07em',
  color: vars.color.textMuted,
  marginBottom: '12px',
});

export const roomGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '12px',
  marginBottom: '16px',
  minWidth: 0,
  width: '100%',
  '@media': {
    '(max-width: 860px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '(max-width: 560px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const roomCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '14px',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgPrimary,
  border: `1px solid ${vars.color.border}`,
  transition: `border-color ${fast}, box-shadow ${fast}`,
  minWidth: 0,
  overflow: 'hidden',
  ':hover': {
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 1px ${vars.color.accent}28`,
  },
});

export const cardTop = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
});

export const cardAvatar = style({
  width: '40px',
  height: '40px',
  borderRadius: vars.radius.sm,
  flexShrink: 0,
  fontSize: '1rem',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  color: '#fff',
});

export const cardInfo = style({
  flex: 1,
  minWidth: 0,
});

export const cardName = style({
  fontWeight: 600,
  fontSize: '0.9rem',
  color: vars.color.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const cardAlias = style({
  fontSize: '0.74rem',
  color: vars.color.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginTop: '2px',
});

export const cardTypeBadge = style({
  fontSize: '0.66rem',
  fontWeight: 700,

  letterSpacing: '0.04em',
  padding: '2px 7px',
  borderRadius: '99px',
  backgroundColor: `${vars.color.accent}20`,
  color: vars.color.accent,
  flexShrink: 0,
});

export const cardTopic = style({
  fontSize: '0.8rem',
  color: vars.color.textSecondary,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  lineHeight: '1.45',
  flex: 1,
});

export const cardFooter = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 'auto',
  paddingTop: '4px',
});

export const cardMembers = style({
  fontSize: '0.76rem',
  color: vars.color.textMuted,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const joinBtn = style({
  padding: '4px 14px',
  borderRadius: vars.radius.sm,
  border: 'none',
  backgroundColor: vars.color.accent,
  color: '#fff',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: `background-color ${fast}, opacity ${fast}`,
  flexShrink: 0,
  ':hover': {
    backgroundColor: vars.color.accentHover,
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

export const joinedBadge = style({
  padding: '4px 10px',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.success}`,
  color: vars.color.success,
  fontSize: '0.78rem',
  fontWeight: 600,
  flexShrink: 0,
});

export const paginationRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  paddingTop: '8px',
  paddingBottom: '4px',
});

export const pageBtn = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 16px',
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bgPrimary,
  color: vars.color.textPrimary,
  fontSize: '0.84rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: `border-color ${fast}, background-color ${fast}`,
  ':hover': {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.bgHover,
  },
  ':disabled': {
    opacity: 0.38,
    cursor: 'not-allowed',
  },
});

export const pageIndicator = style({
  fontSize: '0.82rem',
  color: vars.color.textMuted,
  padding: '0 8px',
  userSelect: 'none',
});

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: '14px',
  padding: '0 40px',
  textAlign: 'center',
  color: vars.color.textMuted,
});

export const emptyTitle = style({
  color: vars.color.textPrimary,
  fontSize: '1.05rem',
  fontWeight: 600,
});

export const emptyBody = style({
  fontSize: '0.88rem',
  lineHeight: '1.55',
  maxWidth: '340px',
});

export const skeletonGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '12px',
  minWidth: 0,
  width: '100%',
  '@media': {
    '(max-width: 860px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
});

export const skeletonCard = style({
  height: '120px',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bgPrimary,
  border: `1px solid ${vars.color.border}`,
  opacity: 0.55,
  selectors: {
    '&:nth-child(even)': {
      opacity: 0.35,
    },
  },
});

export const errorBanner = style({
  margin: '0 0 16px',
  padding: '12px 16px',
  borderRadius: vars.radius.md,
  backgroundColor: `${vars.color.error}18`,
  border: `1px solid ${vars.color.error}44`,
  color: vars.color.error,
  fontSize: '0.85rem',
  textAlign: 'center',
});
