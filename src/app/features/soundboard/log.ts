/**
 * Soundboard failures are never allowed to disturb a call: they are logged here and swallowed.
 * (matrix-js-sdk's own `logger` export is deprecated outside the client constructor.)
 */
export const logger = {
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
};
