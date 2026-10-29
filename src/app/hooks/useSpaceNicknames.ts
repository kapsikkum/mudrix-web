import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { ClientEvent, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
  currentRoomIdAtom,
  currentSpaceIdAtom,
  promptModalAtom,
  sidebarViewAtom,
} from '@/app/store/atoms';
import { useSyncReady } from '@/app/hooks/useSync';
import { useToast } from '@/app/hooks/useToast';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import {
  applyDisplayName,
  getSpaceNicknames,
  cachedGlobalDisplayName,
  fetchGlobalDisplayName,
  joinedRoomsOfSpace,
  nicknameTargets,
  setSpaceNickname,
  useSpaceNicknames,
} from '@/util/spaceNicknames';

const SETTLE_MS = 2500;

/**
 * Keeps your nickname for each space on your profile in all of that space's rooms: when the
 * nickname is set on another device, and for rooms you join in the space later.
 */
export function useSpaceNicknameSync(client: MatrixClient | null): void {
  const syncReady = useSyncReady();
  const nicknames = useSpaceNicknames(client);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);

  // The rooms a nickname applies to, as of the last run.
  const watched = useRef(new Set<string>());
  // Something changed while a run was going: go round again once it is done.
  const again = useRef(false);

  const run = useCallback(async () => {
    if (!client) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        const targets = nicknameTargets(client, getSpaceNicknames(client));
        watched.current = new Set(targets.keys());
        for (const [roomId, nickname] of targets) {
          await applyDisplayName(client, [roomId], nickname);
        }
      } while (again.current);
    } finally {
      running.current = false;
    }
  }, [client]);

  const schedule = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void run();
    }, SETTLE_MS);
  }, [run]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    []
  );

  useEffect(() => {
    if (syncReady && Object.keys(nicknames).length > 0) schedule();
  }, [syncReady, nicknames, schedule]);

  // A room joined (or a room added to the space) later gets the nickname too.
  useMatrixEvent(client, RoomEvent.MyMembership, (_room, membership) => {
    if (syncReady && membership === 'join' && Object.keys(getSpaceNicknames(client!)).length > 0) {
      schedule();
    }
  });
  useMatrixEvent(client, ClientEvent.Room, () => {
    if (syncReady && client && Object.keys(getSpaceNicknames(client)).length > 0) schedule();
  });
  // Your name in a room changing under you (the server rewrites every room when you change your
  // profile name, and another device may reset one) puts the nickname back.
  useMatrixEvent(client, RoomStateEvent.Members, (event: MatrixEvent) => {
    if (!syncReady || !client || event.getStateKey() !== client.getUserId()) return;
    // Only rooms that have a nickname; a profile rename touches every room you are in.
    const roomId = event.getRoomId();
    if (roomId && watched.current.has(roomId)) schedule();
  });
}

/**
 * Your own name, for the places that show it outside any room (the user panel, the status menu, the
 * home greeting). With nicknames in use the SDK's copy flips between them as rooms load, so this
 * follows your profile instead.
 */
export function useOwnDisplayName(client: MatrixClient | null): string | undefined {
  const me = client?.getUserId() ?? '';
  const nicknames = useSpaceNicknames(client);
  const hasNicknames = Object.keys(nicknames).length > 0;
  const sidebarView = useAtomValue(sidebarViewAtom);
  const spaceId = useAtomValue(currentSpaceIdAtom);
  const roomId = useAtomValue(currentRoomIdAtom);

  // In a space you go by your nickname there: the open room's if it sits in the space, else the
  // space's own. Home and direct messages use your profile name.
  const spaceNickname = useMemo(() => {
    if (!client || !hasNicknames || sidebarView !== 'space' || !spaceId) return undefined;
    if (roomId && joinedRoomsOfSpace(client, spaceId).includes(roomId)) {
      return nicknameTargets(client, nicknames).get(roomId);
    }
    return nicknames[spaceId];
  }, [client, hasNicknames, nicknames, sidebarView, spaceId, roomId]);
  const [profileName, setProfileName] = useState(() =>
    client ? cachedGlobalDisplayName(client) : undefined
  );
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (client) void fetchGlobalDisplayName(client).then(setProfileName);
  }, [client]);

  useEffect(() => {
    if (hasNicknames) refresh();
  }, [hasNicknames, refresh]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    []
  );

  useMatrixEvent(client, 'User.displayName', (_event: MatrixEvent, user: { userId: string }) => {
    if (user.userId !== me) return;
    rerender();
    // A rename of your profile lands here too; look again once things settle.
    if (!hasNicknames) return;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 800);
  });

  const sdkName = client?.getUser(me)?.displayName;
  return spaceNickname ?? (hasNicknames ? profileName : undefined) ?? sdkName ?? undefined;
}

/** Opens the "Nickname in this space" prompt and applies the answer; empty goes back to your name. */
export function useSpaceNicknamePrompt(client: MatrixClient | null) {
  const { t } = useTranslation();
  const toast = useToast();
  const setPrompt = useSetAtom(promptModalAtom);

  return useCallback(
    async (spaceId: string, spaceName: string) => {
      if (!client) return;
      const current = getSpaceNicknames(client)[spaceId] ?? '';
      const answer = await new Promise<string | null>((resolve) => {
        setPrompt({
          open: true,
          title: t('room.space.nickname.title', { name: spaceName }),
          message: t('room.space.nickname.message'),
          defaultValue: current,
          resolve,
        });
      });
      if (answer === null) return;
      const nickname = answer.trim().slice(0, 255);
      if (nickname === current) return;
      try {
        const next = { ...getSpaceNicknames(client) };
        if (nickname) next[spaceId] = nickname;
        else delete next[spaceId];
        await setSpaceNickname(client, spaceId, nickname || null);
        toast.info(t(nickname ? 'room.space.nickname.applying' : 'room.space.nickname.resetting'));
        // Rooms that a sub-space (or another space) has its own nickname for keep that one; the
        // rest take this nickname, or your own name when it was cleared.
        const targets = nicknameTargets(client, next);
        const fallback = await fetchGlobalDisplayName(client);
        for (const roomId of joinedRoomsOfSpace(client, spaceId)) {
          await applyDisplayName(client, [roomId], targets.get(roomId) ?? fallback);
        }
        toast.success(t(nickname ? 'room.space.nickname.done' : 'room.space.nickname.reset'));
      } catch {
        toast.error(t('room.space.nickname.failed'));
      }
    },
    [client, setPrompt, t, toast]
  );
}
