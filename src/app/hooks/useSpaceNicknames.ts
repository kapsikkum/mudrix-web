import { useCallback, useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { ClientEvent, RoomEvent } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { promptModalAtom } from '@/app/store/atoms';
import { useSyncReady } from '@/app/hooks/useSync';
import { useToast } from '@/app/hooks/useToast';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import {
  applyDisplayName,
  getSpaceNicknames,
  globalDisplayName,
  joinedRoomsOfSpace,
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

  const run = useCallback(async () => {
    if (!client || running.current) return;
    running.current = true;
    try {
      for (const [spaceId, nickname] of Object.entries(getSpaceNicknames(client))) {
        if (client.getRoom(spaceId)?.getMyMembership() !== 'join') continue;
        await applyDisplayName(client, joinedRoomsOfSpace(client, spaceId), nickname);
      }
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
        await setSpaceNickname(client, spaceId, nickname || null);
        const rooms = joinedRoomsOfSpace(client, spaceId);
        toast.info(t(nickname ? 'room.space.nickname.applying' : 'room.space.nickname.resetting'));
        await applyDisplayName(client, rooms, nickname || globalDisplayName(client));
        toast.success(t(nickname ? 'room.space.nickname.done' : 'room.space.nickname.reset'));
      } catch {
        toast.error(t('room.space.nickname.failed'));
      }
    },
    [client, setPrompt, t, toast]
  );
}
