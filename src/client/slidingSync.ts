import type { MatrixClient } from 'matrix-js-sdk';
import {
  SlidingSync,
  SlidingSyncEvent,
  SlidingSyncState,
  MSC3575_STATE_KEY_ME,
  MSC3575_STATE_KEY_LAZY,
  type MSC3575List,
  type MSC3575RoomSubscription,
} from 'matrix-js-sdk/lib/sliding-sync';
import { STORAGE_KEY_SLIDING_SYNC } from '@/const/storageKeys';

/** The unstable feature flag Synapse (and others) advertise for MSC4186 simplified sliding sync. */
const FEATURE = 'org.matrix.simplified_msc3575';

const LIST_ID = 'all_rooms';
const FIRST_WINDOW = 50;
const WINDOW_STEP = 100;
const TIMELINE_LIMIT = 20;
const POLL_TIMEOUT_MS = 30000;

/** State every room needs for the room list, spaces, permissions and encryption. */
const LIST_REQUIRED_STATE: string[][] = [
  ['m.room.name', ''],
  ['m.room.avatar', ''],
  ['m.room.canonical_alias', ''],
  ['m.room.topic', ''],
  ['m.room.create', ''],
  ['m.room.join_rules', ''],
  ['m.room.history_visibility', ''],
  ['m.room.encryption', ''],
  ['m.room.power_levels', ''],
  ['m.room.tombstone', ''],
  ['m.room.pinned_events', ''],
  ['m.room.member', MSC3575_STATE_KEY_ME],
  ['m.room.member', MSC3575_STATE_KEY_LAZY],
  ['m.space.child', '*'],
  ['m.space.parent', '*'],
];

/** The room being viewed gets everything (widgets, voice room state, custom state events). */
const ACTIVE_ROOM_SUBSCRIPTION: MSC3575RoomSubscription = {
  required_state: [['*', '*']],
  timeline_limit: 50,
};

let active: SlidingSync | null = null;

export function isSlidingSyncEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SLIDING_SYNC) === '1';
  } catch {
    return false;
  }
}

export function setSlidingSyncEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY_SLIDING_SYNC, '1');
    else localStorage.removeItem(STORAGE_KEY_SLIDING_SYNC);
  } catch {
    // storage unavailable; the setting just won't persist
  }
}

export function getActiveSlidingSync(): SlidingSync | null {
  return active;
}

export async function serverSupportsSlidingSync(client: MatrixClient): Promise<boolean> {
  try {
    return await client.doesServerSupportUnstableFeature(FEATURE);
  } catch {
    return false;
  }
}

/**
 * Builds a SlidingSync with one list covering every room. The window starts small so the first
 * response is fast, then grows until it reaches the server's room count.
 */
export function createSlidingSync(client: MatrixClient, baseUrl: string): SlidingSync {
  const list: MSC3575List = {
    ranges: [[0, FIRST_WINDOW - 1]],
    timeline_limit: TIMELINE_LIMIT,
    required_state: LIST_REQUIRED_STATE,
  };
  const sync = new SlidingSync(
    baseUrl,
    new Map([[LIST_ID, list]]),
    ACTIVE_ROOM_SUBSCRIPTION,
    client,
    POLL_TIMEOUT_MS
  );

  let end = FIRST_WINDOW - 1;
  sync.on(SlidingSyncEvent.Lifecycle, (state, resp) => {
    if (state !== SlidingSyncState.Complete || !resp) return;
    const count = resp.lists?.[LIST_ID]?.count;
    if (typeof count !== 'number' || end >= count - 1) return;
    end = Math.min(end + WINDOW_STEP, count - 1);
    sync.setListRanges(LIST_ID, [[0, end]]);
  });

  active = sync;
  return sync;
}

/** Keeps the viewed room fully subscribed, regardless of its position in the list window. */
export function subscribeToRoom(roomId: string | null): void {
  active?.modifyRoomSubscriptions(new Set(roomId ? [roomId] : []));
}

export function clearSlidingSync(): void {
  active = null;
}
