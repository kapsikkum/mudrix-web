/**
 * Phones, and touch tablets up to landscape size: the members, thread and chat side panels slide
 * over the content instead of sitting beside it, which would leave the chat a sliver on an 800px
 * tablet. Matches the query that already turns popovers into sheets. Pure string so .css.ts can use it.
 */
export const PANEL_OVERLAY_QUERY = '(max-width: 768px), (pointer: coarse) and (max-width: 1100px)';
