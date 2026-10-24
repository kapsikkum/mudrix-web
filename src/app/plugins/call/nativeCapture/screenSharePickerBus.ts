import type { CaptureSource } from '@/util/desktop';

/**
 * Hands "which screen or window?" requests from the (non-React) getDisplayMedia override to the
 * picker dialog rendered in the app, and the answer back.
 */

export interface ScreenShareChoice {
  source: CaptureSource;
  /** 0 keeps the source's native height. */
  maxHeight: number;
  fps: number;
  audio: boolean;
  cursor: boolean;
}

export interface ScreenSharePickRequest {
  /** The call asked for audio; when false the dialog hides its audio toggle. */
  allowAudio: boolean;
}

interface PendingPick extends ScreenSharePickRequest {
  resolve: (choice: ScreenShareChoice | null) => void;
}

let pending: PendingPick | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Opens the picker. Resolves with the choice, or null when it was cancelled or replaced. */
export function requestScreenSharePick(allowAudio: boolean): {
  promise: Promise<ScreenShareChoice | null>;
  cancel: () => void;
} {
  resolveScreenSharePick(null);
  let resolveRequest: PendingPick['resolve'] = () => {};
  const promise = new Promise<ScreenShareChoice | null>((resolve) => {
    resolveRequest = resolve;
  });
  const request: PendingPick = { allowAudio, resolve: resolveRequest };
  pending = request;
  emit();
  return {
    promise,
    cancel: () => {
      if (pending === request) resolveScreenSharePick(null);
    },
  };
}

/** Answers the open request (null cancels it) and closes the dialog. */
export function resolveScreenSharePick(choice: ScreenShareChoice | null): void {
  const current = pending;
  if (!current) return;
  pending = null;
  emit();
  current.resolve(choice);
}

export function getScreenSharePickRequest(): ScreenSharePickRequest | null {
  return pending;
}

export function subscribeScreenSharePick(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
