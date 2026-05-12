export const isMac =
  typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

export const MODIFIER_KEY = isMac ? '⌘' : 'Ctrl';
