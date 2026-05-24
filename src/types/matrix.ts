import type { StateEvents } from 'matrix-js-sdk';

export type UntypedStateEventType = keyof StateEvents;
export type RawStateContent = StateEvents[keyof StateEvents];
