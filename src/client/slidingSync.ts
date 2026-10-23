import { EventTimeline, RoomEvent, User, type MatrixClient } from 'matrix-js-sdk';
import {
  SlidingSync,
  SlidingSyncEvent,
  SlidingSyncState,
  MSC3575_STATE_KEY_ME,
  MSC3575_STATE_KEY_LAZY,
  type MSC3575List,
  type MSC3575RoomSubscription,
} from 'matrix-js-sdk/lib/sliding-sync';
import { STORAGE_KEY_PREFERENCES } from '@/const/storageKeys';

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

/**
 * Read straight from the stored preferences: the client starts before any React state exists.
 * The preference is synced through account data like the others, so it follows the account.
 */
export function isSlidingSyncEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFERENCES);
    return raw ? JSON.parse(raw)?.slidingSync === true : false;
  } catch {
    return false;
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

  // The SDK leaves timeline events encrypted under sliding sync ("room::decryptCriticalEvents is
  // in charge"), so everything but the newest message rendered blank. Decrypt each room's events
  // once its data has been processed.
  const touched = new Set<string>();
  sync.on(SlidingSyncEvent.RoomData, (roomId) => {
    touched.add(roomId);
  });

  // The SDK adds sliding sync timeline events with `addToState: false`, trusting the server to
  // repeat every state change in `required_state`. tuwunel does not, so state sent mid-session
  // (e.g. MatrixRTC call memberships) never reached the room state and Element Call saw no
  // participants. Roll the live state forward from live timeline state events instead.
  client.on(RoomEvent.Timeline, (ev, room, toStartOfTimeline, _removed, data) => {
    if (toStartOfTimeline || !room || !ev.isState() || data.timeline !== room.getLiveTimeline()) {
      return;
    }
    const state = data.timeline.getState(EventTimeline.FORWARDS);
    const current = state?.getStateEvents(ev.getType(), ev.getStateKey()!);
    if (!state || current?.getId() === ev.getId()) return;
    if (current && current.getTs() > ev.getTs()) return;
    state.setStateEvents([ev]);
  });

  let end = FIRST_WINDOW - 1;
  sync.on(SlidingSyncEvent.Lifecycle, (state, resp) => {
    if (state !== SlidingSyncState.Complete || !resp) return;
    for (const roomId of touched) {
      client
        .getRoom(roomId)
        ?.decryptAllEvents()
        .catch(() => {});
    }
    touched.clear();
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

/**
 * Classic sync fills the own User object (display name, avatar) from membership events as it
 * processes them; sliding sync does not, which left Settings and the user panel without a profile.
 */
export async function seedOwnProfile(client: MatrixClient): Promise<void> {
  const userId = client.getUserId();
  if (!userId) return;
  try {
    const info = await client.getProfileInfo(userId);
    let user = client.getUser(userId);
    if (!user) {
      user = new User(userId);
      client.store.storeUser(user);
    }
    if (info.displayname) user.setDisplayName(info.displayname);
    if (info.avatar_url) user.setAvatarUrl(info.avatar_url);
  } catch {
    // profile is cosmetic; keep going without it
  }
}
