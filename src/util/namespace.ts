import type { MatrixClient, MatrixEvent, RoomState } from 'matrix-js-sdk';

/**
 * Mudrix's namespace for custom Matrix event types, account data, room state and profile keys. The
 * spec asks for reverse-DNS names under a domain you control; this one hangs off the project's
 * GitHub Pages host (kapsikkum.github.io).
 *
 * Earlier versions used `chat.mudrix.*` (and a few `io.mudrix.*` / `org.mudrix.*`), which are not
 * ours. Those names are still read, so existing data keeps working, and what other people read
 * (room state, profile fields) is written under both names until older clients are gone.
 */
export const MUDRIX_NS = 'io.github.kapsikkum.mudrix';

/** The current name of a Mudrix type or key. */
export const mudrixKey = (name: string): string => `${MUDRIX_NS}.${name}`;

/** The name earlier versions used for it. */
export const legacyMudrixKey = (name: string): string => `chat.mudrix.${name}`;

/** The name earlier versions used for a current Mudrix type (`io.github...mudrix.x` to `chat.mudrix.x`). */
export const legacyTypeOf = (type: string): string =>
  type.startsWith(`${MUDRIX_NS}.`) ? legacyMudrixKey(type.slice(MUDRIX_NS.length + 1)) : type;

/** A current Mudrix type and the name earlier versions used for it, current first. */
export const typeAndLegacy = (type: string): readonly [string, string] => [
  type,
  legacyTypeOf(type),
];

/** Whether an event of type `actual` is of the Mudrix type `type`, under either of its names. */
export const isMudrixType = (actual: string, type: string): boolean =>
  actual === type || actual === legacyTypeOf(type);

/** The first of `types` that `get` finds something for. */
export function firstOf<T>(
  get: (type: string) => T | undefined,
  types: readonly string[]
): T | undefined {
  for (const type of types) {
    const found = get(type);
    if (found) return found;
  }
  return undefined;
}

/** The first of `keys` that is set on a plain object (a profile, event content). */
export function firstKeyOf(raw: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  }
  return undefined;
}

type StateReader = Pick<RoomState, 'getStateEvents'>;

/**
 * A room state event of a Mudrix type: the most recently sent of the current name and the legacy
 * one. Current versions write both, so they only differ when an older client changed it.
 */
export function newestStateEvent(
  state: StateReader | null | undefined,
  type: string,
  stateKey: string
): MatrixEvent | undefined {
  let best: MatrixEvent | undefined;
  for (const name of typeAndLegacy(type)) {
    const event = state?.getStateEvents(name, stateKey);
    if (event && (!best || event.getTs() > best.getTs())) best = event;
  }
  return best;
}

/** Every state event of a Mudrix type, the newest per state key across both names. */
export function newestStateEvents(
  state: StateReader | null | undefined,
  type: string
): MatrixEvent[] {
  const byKey = new Map<string, MatrixEvent>();
  for (const name of typeAndLegacy(type)) {
    for (const event of state?.getStateEvents(name) ?? []) {
      const key = event.getStateKey() ?? '';
      const known = byKey.get(key);
      if (!known || event.getTs() > known.getTs()) byKey.set(key, event);
    }
  }
  return [...byKey.values()];
}

/**
 * Sets room state under the current type, then under the legacy one so clients that have not
 * updated still see it. A failure of the first is the caller's to handle; the second is best effort.
 */
export async function sendMudrixState(
  client: MatrixClient,
  roomId: string,
  type: string,
  content: object,
  stateKey = ''
): Promise<void> {
  await client.sendStateEvent(roomId, type as never, content as never, stateKey);
  try {
    await client.sendStateEvent(roomId, legacyTypeOf(type) as never, content as never, stateKey);
  } catch {
    // The room may not let the legacy type through; the current one is what this version reads.
  }
}
