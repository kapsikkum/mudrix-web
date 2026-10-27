import { useMemo, useSyncExternalStore } from 'react';
import { atom } from 'jotai';
import { MatrixEventEvent, RoomEvent } from 'matrix-js-sdk';
import type { EventTimeline, MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { DecryptionFailureCode } from 'matrix-js-sdk/lib/crypto-api';

/** Runs of at least this many consecutive undecryptable messages are folded into one row. */
export const UNDECRYPTABLE_RUN_THRESHOLD = 3;

/** Rooms in which the user chose to see every undecryptable message instead of the folded row. */
export const expandedUndecryptableRoomsAtom = atom<ReadonlySet<string>>(new Set<string>());

/** Marker on the (invisible) placeholder of a folded message; see UndecryptableMessage.css.ts. */
export const FOLDED_UNDECRYPTABLE_ATTR = 'data-undecryptable-folded';

export type UndecryptableCause =
  | 'unknownSession'
  | 'withheld'
  | 'withheldUnverified'
  | 'laterIndex'
  | 'historicalNoBackup'
  | 'historicalBackupUnconfigured'
  | 'historicalWorkingBackup'
  | 'historicalNotJoined'
  | 'senderPreviouslyVerified'
  | 'unsignedSender'
  | 'unknownSender'
  | 'unknown';

export function getUndecryptableCause(event: MatrixEvent): UndecryptableCause {
  switch (event.decryptionFailureReason) {
    case DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID:
      return 'unknownSession';
    case DecryptionFailureCode.MEGOLM_KEY_WITHHELD:
      return 'withheld';
    case DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE:
      return 'withheldUnverified';
    case DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX:
      return 'laterIndex';
    case DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP:
      return 'historicalNoBackup';
    case DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED:
      return 'historicalBackupUnconfigured';
    case DecryptionFailureCode.HISTORICAL_MESSAGE_WORKING_BACKUP:
      return 'historicalWorkingBackup';
    case DecryptionFailureCode.HISTORICAL_MESSAGE_USER_NOT_JOINED:
      return 'historicalNotJoined';
    case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
      return 'senderPreviouslyVerified';
    case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
      return 'unsignedSender';
    case DecryptionFailureCode.UNKNOWN_SENDER_DEVICE:
      return 'unknownSender';
    default:
      return 'unknown';
  }
}

/** Causes where the message was sent before this device existed and its key may live in a backup. */
export function isRecoverableFromBackup(cause: UndecryptableCause): boolean {
  return (
    cause === 'historicalNoBackup' ||
    cause === 'historicalBackupUnconfigured' ||
    cause === 'historicalWorkingBackup' ||
    cause === 'unknownSession' ||
    cause === 'laterIndex' ||
    cause === 'unknown'
  );
}

/** Causes that no action on this device can fix. */
export function isUnrecoverable(cause: UndecryptableCause): boolean {
  return (
    cause === 'historicalNotJoined' ||
    cause === 'withheld' ||
    cause === 'unsignedSender' ||
    cause === 'unknownSender' ||
    cause === 'senderPreviouslyVerified'
  );
}

export interface UndecryptableRun {
  /** Number of undecryptable messages in the run this event belongs to. */
  count: number;
  /** True for the first undecryptable message of the run. */
  isFirst: boolean;
  /** The undecryptable events of the run, oldest first. */
  events: MatrixEvent[];
}

/** Events that never show as their own timeline row, so they do not interrupt a run. */
function isInvisibleToRun(event: MatrixEvent): boolean {
  const type = event.getType();
  if (type === 'm.reaction' || type === 'm.room.redaction') return true;
  const rel = event.getRelation()?.rel_type;
  return rel === 'm.replace' || rel === 'm.annotation' || rel === 'm.reference';
}

// Bumped on every (de)cryption and timeline change, so cached runs are never stale. Attached on the
// first lookup, not on mount, so even the first render of a placeholder can't miss a change.
let runsVersion = 0;
let runsClient: MatrixClient | null = null;
const bumpRunsVersion = () => {
  runsVersion += 1;
};

function watchRunsVersion(client: MatrixClient): void {
  if (runsClient === client) return;
  if (runsClient) {
    runsClient.off(MatrixEventEvent.Decrypted, bumpRunsVersion);
    runsClient.off(RoomEvent.Timeline, bumpRunsVersion);
    runsClient.off(RoomEvent.Redaction, bumpRunsVersion);
  }
  runsClient = client;
  client.on(MatrixEventEvent.Decrypted, bumpRunsVersion);
  client.on(RoomEvent.Timeline, bumpRunsVersion);
  client.on(RoomEvent.Redaction, bumpRunsVersion);
  bumpRunsVersion();
}

interface RunsCache {
  version: number;
  length: number;
  runs: Map<MatrixEvent, UndecryptableRun>;
}

const runsCache = new WeakMap<EventTimeline, RunsCache>();

/** Every run of undecryptable messages in a timeline, in one pass. */
function computeRuns(events: readonly MatrixEvent[]): Map<MatrixEvent, UndecryptableRun> {
  const runs = new Map<MatrixEvent, UndecryptableRun>();
  let current: MatrixEvent[] = [];
  const flush = () => {
    const run = current;
    run.forEach((e, i) => runs.set(e, { count: run.length, isFirst: i === 0, events: run }));
    current = [];
  };
  for (const e of events) {
    if (e.isDecryptionFailure()) current.push(e);
    else if (!isInvisibleToRun(e)) flush();
  }
  flush();
  return runs;
}

/**
 * Find the run of consecutive undecryptable messages this event belongs to, looking at the loaded
 * timeline around it. Returns null when the event is not part of a loaded main timeline.
 *
 * Runs are worked out once per timeline and change, not once per placeholder: a room with a
 * thousand undecryptable messages has a thousand (mostly folded) placeholders asking.
 */
export function getUndecryptableRun(
  client: MatrixClient,
  event: MatrixEvent
): UndecryptableRun | null {
  const roomId = event.getRoomId();
  const eventId = event.getId();
  if (!roomId || !eventId) return null;
  const room = client.getRoom(roomId);
  if (!room) return null;
  const timeline = room.getTimelineForEvent(eventId);
  if (!timeline) return null;

  watchRunsVersion(client);
  const events = timeline.getEvents();
  let cached = runsCache.get(timeline);
  if (!cached || cached.version !== runsVersion || cached.length !== events.length) {
    cached = { version: runsVersion, length: events.length, runs: computeRuns(events) };
    runsCache.set(timeline, cached);
  }
  const run = cached.runs.get(event);
  if (run) return run;
  return events.includes(event) ? { count: 0, isFirst: false, events: [] } : null;
}

// One shared, throttled subscription so every visible placeholder re-evaluates its run when
// messages around it (de)crypt, without each one listening to the client on its own.
let tick = 0;
let tickClient: MatrixClient | null = null;
let tickTimer: ReturnType<typeof setTimeout> | undefined;
let tickUsers = 0;
const tickListeners = new Set<() => void>();

function onDecrypted(): void {
  if (tickTimer) return;
  tickTimer = setTimeout(() => {
    tickTimer = undefined;
    tick += 1;
    tickListeners.forEach((l) => l());
  }, 250);
}

function subscribeTick(client: MatrixClient): (listener: () => void) => () => void {
  return (listener) => {
    tickListeners.add(listener);
    tickUsers += 1;
    if (tickUsers === 1 || tickClient !== client) {
      tickClient?.off(MatrixEventEvent.Decrypted, onDecrypted);
      tickClient = client;
      client.on(MatrixEventEvent.Decrypted, onDecrypted);
    }
    return () => {
      tickListeners.delete(listener);
      tickUsers -= 1;
      if (tickUsers <= 0) {
        tickUsers = 0;
        tickClient?.off(MatrixEventEvent.Decrypted, onDecrypted);
        tickClient = null;
        clearTimeout(tickTimer);
        tickTimer = undefined;
      }
    };
  };
}

const getTick = () => tick;

/** A counter that changes (throttled) whenever any event in the client is decrypted. */
export function useDecryptionTick(client: MatrixClient): number {
  const subscribe = useMemo(() => subscribeTick(client), [client]);
  return useSyncExternalStore(subscribe, getTick, getTick);
}
