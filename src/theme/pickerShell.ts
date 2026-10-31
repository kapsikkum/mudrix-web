import type { StyleRule } from '@vanilla-extract/css';
import { vars } from './vars.css';
import { zIndex } from './zIndex';
import { PANEL_OVERLAY_QUERY } from '@/const/breakpoints';

/** A picker on a phone: a bottom drawer across the screen instead of a popover by its anchor. */
export const pickerDrawer = {
  left: '0 !important',
  right: '0 !important',
  top: 'auto !important',
  bottom: '0 !important',
  width: 'auto',
  // About the height of the on-screen keyboard.
  height: 'clamp(300px, 40dvh, 440px)',
  borderRadius: '20px 20px 0 0',
  paddingBottom: 'var(--safe-bottom)',
} satisfies StyleRule;

/** The emoji, GIF and sticker picker box: a floating popover, a bottom drawer on phones. */
export const pickerPopover = (width: string, height: string) =>
  ({
    width,
    height,
    backgroundColor: vars.color.bgSecondary,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    overflow: 'hidden',
    boxShadow: vars.shadow.popup,
    display: 'flex',
    flexDirection: 'column',
    zIndex: zIndex.panel,
    '@media': {
      [PANEL_OVERLAY_QUERY]: { position: 'fixed', ...pickerDrawer },
    },
  }) satisfies StyleRule;

/** A picker that fills a host panel (the composer's tabbed picker) instead of floating. */
export const pickerNaked = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
} satisfies StyleRule;
