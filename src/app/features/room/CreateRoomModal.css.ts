import { style } from '@vanilla-extract/css';
import { vars } from '@/theme/vars.css';

export {
  settingInfo,
  settingLabel,
  settingNote,
  settingRow,
  radioCircle,
  radioCircleSelected,
  radioCircleDot,
} from '@/app/components/Settings/Settings.css.ts';

export const header = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  alignItems: 'center',
  textAlign: 'center',
});

export const title = style({
  fontSize: '1.2rem',
  fontWeight: 700,
  color: vars.color.textPrimary,
});

export const accessSection = style({
  display: 'flex',
  flexDirection: 'column',
});

export const accessLabel = style({
  fontSize: '0.85rem',
  fontWeight: 600,
  color: vars.color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});
