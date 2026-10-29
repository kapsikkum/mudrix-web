import { useEffect, useState } from 'react';
import { ClientEvent, EventType, MatrixEvent } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import type { RoomMemberEventContent } from 'matrix-js-sdk/lib/@types/state_events';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { isActiveSpaceChild, roomState } from '@/util/matrix';
import { firstOf, legacyMudrixKey, mudrixKey } from '@/util/namespace';

// Matrix names you per room, not per space, so a "nickname in this space" is kept as a wish in
// account data and written to the profile of every room of the space (and the space itself).
const NICKNAMES_TYPE = mudrixKey('space_nicknames');
const LEGACY_NICKNAMES_TYPE = legacyMudrixKey('space_nicknames');
const MAX_RATE_LIMIT_WAITS = 5;

type AccountDataClient = {
  getAccountData(type: string): { getContent(): unknown } | undefined;
  setAccountData(type: string, content: object): Promise<unknown>;
};

const dataClient = (client: MatrixClient) => client as unknown as AccountDataClient;

/** Space id to the nickname chosen for it. */
export function getSpaceNicknames(client: MatrixClient): Record<string, string> {
  const data = dataClient(client);
  const content = firstOf(
    (type) => data.getAccountData(type),
    [NICKNAMES_TYPE, LEGACY_NICKNAMES_TYPE]
  )?.getContent() as Record<string, unknown> | undefined;
  const out: Record<string, string> = {};
  for (const [spaceId, name] of Object.entries(content ?? {})) {
    if (typeof name === 'string' && name.trim()) out[spaceId] = name;
  }
  return out;
}

export async function setSpaceNickname(
  client: MatrixClient,
  spaceId: string,
  nickname: string | null
): Promise<void> {
  const next = { ...getSpaceNicknames(client) };
  if (nickname) next[spaceId] = nickname;
  else delete next[spaceId];
  await dataClient(client).setAccountData(NICKNAMES_TYPE, next);
}

export function useSpaceNicknames(client: MatrixClient | null): Record<string, string> {
  const [nicknames, setNicknames] = useState<Record<string, string>>(() =>
    client ? getSpaceNicknames(client) : {}
  );
  useEffect(() => {
    setNicknames(client ? getSpaceNicknames(client) : {});
  }, [client]);
  useMatrixEvent(client, ClientEvent.AccountData, (ev: MatrixEvent) => {
    const type = ev.getType();
    if (client && (type === NICKNAMES_TYPE || type === LEGACY_NICKNAMES_TYPE)) {
      setNicknames(getSpaceNicknames(client));
    }
  });
  return nicknames;
}

/** The space and every room below it (including sub-spaces) that you have joined. */
export function joinedRoomsOfSpace(client: MatrixClient, spaceId: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const visit = (roomId: string) => {
    if (seen.has(roomId)) return;
    seen.add(roomId);
    const room = client.getRoom(roomId);
    if (!room) return;
    if (room.getMyMembership() === 'join') out.push(roomId);
    if (room.isSpaceRoom()) {
      for (const ev of roomState(room).getStateEvents('m.space.child').filter(isActiveSpaceChild)) {
        const childId = ev.getStateKey();
        if (childId) visit(childId);
      }
    }
  };
  visit(spaceId);
  return out;
}

/**
 * The nickname each joined room should show you under. A room in a space with a nickname of its own
 * (a sub-space) shows that one rather than its parent's; a room reached from several unrelated
 * spaces takes the same one every time, so two nicknames never fight over it.
 */
export function nicknameTargets(
  client: MatrixClient,
  nicknames: Record<string, string>
): Map<string, string> {
  const spaces = Object.entries(nicknames)
    .filter(([spaceId]) => client.getRoom(spaceId)?.getMyMembership() === 'join')
    .map(([spaceId, nickname]) => ({
      spaceId,
      nickname,
      rooms: joinedRoomsOfSpace(client, spaceId),
    }))
    // The closest space is the one with the fewest rooms below it; ties go by id.
    .sort((a, b) => b.rooms.length - a.rooms.length || (a.spaceId < b.spaceId ? 1 : -1));
  const targets = new Map<string, string>();
  // Widest first, so each narrower space overwrites what it sits inside.
  for (const { rooms, nickname } of spaces) {
    for (const roomId of rooms) targets.set(roomId, nickname);
  }
  return targets;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function retryAfter(err: unknown): number | null {
  const e = err as { errcode?: string; data?: { retry_after_ms?: number } };
  if (e?.errcode !== 'M_LIMIT_EXCEEDED') return null;
  return Math.min(Math.max(e.data?.retry_after_ms ?? 1000, 250), 30_000);
}

// The SDK's `User.displayName` is whichever room's member event it saw last, so with a nickname in
// some rooms it is sometimes the nickname. Your own name comes from your profile instead.
const profileNames = new Map<string, string>();

/** Your name from the last profile lookup, if there has been one. */
export function cachedGlobalDisplayName(client: MatrixClient): string | undefined {
  return profileNames.get(client.getUserId() ?? '');
}

/** The name you show everywhere that no space nickname is set, from your profile. */
export async function fetchGlobalDisplayName(client: MatrixClient): Promise<string> {
  const me = client.getUserId() ?? '';
  try {
    const { displayname } = await client.getProfileInfo(me);
    if (displayname) profileNames.set(me, displayname);
  } catch {
    // keep what we had
  }
  return profileNames.get(me) || me.replace(/^@/, '').split(':')[0];
}

/**
 * Makes `displayname` your name in the given rooms (the room you are in keeps its other member
 * settings). Rooms already showing it are skipped; returns how many were changed.
 */
export async function applyDisplayName(
  client: MatrixClient,
  roomIds: string[],
  displayname: string
): Promise<number> {
  const me = client.getUserId();
  if (!me) return 0;
  let changed = 0;
  for (const roomId of roomIds) {
    const room = client.getRoom(roomId);
    const member = room && roomState(room).getStateEvents(EventType.RoomMember, me);
    const content = member?.getContent();
    if (!content || content.membership !== 'join' || content.displayname === displayname) {
      continue;
    }
    for (let waits = 0; ; waits += 1) {
      try {
        await client.sendStateEvent(
          roomId,
          EventType.RoomMember,
          { ...content, membership: 'join', displayname } as RoomMemberEventContent,
          me
        );
        changed += 1;
        break;
      } catch (err) {
        const wait = retryAfter(err);
        if (wait === null || waits >= MAX_RATE_LIMIT_WAITS) break;
        await sleep(wait);
      }
    }
  }
  return changed;
}
