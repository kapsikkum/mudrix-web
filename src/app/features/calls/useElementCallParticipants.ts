import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { elementCallEmbedAtom, elementCallUiAtom } from '@/app/store/atoms/elementCall';
import type { VoiceParticipant } from '@/app/features/calls/types';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId } from '@/util/matrix';
import { useElementCallMemberships, uniqueMembers } from './useElementCallMemberships';

export { uniqueMembers };

interface LiveTileState {
  muted: boolean;
  videoMuted: boolean;
  screensharing: boolean;
  speaking: boolean;
}

const NO_LIVE_STATE = new Map<string, LiveTileState>();

function getEmbedDocument(embed: { document: Document | undefined }): Document | undefined {
  try {
    return embed.document;
  } catch {
    return undefined;
  }
}

function getFiberFromNode(node: Element): Record<string, unknown> | null {
  const anyNode = node as unknown as Record<string, unknown>;
  for (const key of Object.keys(anyNode)) {
    if (key.startsWith('__reactFiber$')) {
      return anyNode[key] as Record<string, unknown>;
    }
  }
  return null;
}

function findMediaVm(fiber: Record<string, unknown> | null): Record<string, unknown> | null {
  let current = fiber;
  while (current) {
    const props = current.memoizedProps as Record<string, unknown> | undefined;
    const vm = props?.vm as Record<string, unknown> | undefined;
    if (
      vm &&
      typeof vm === 'object' &&
      (vm.audioEnabled$ || vm.videoEnabled$ || (vm.type as unknown) === 'screen share') &&
      vm.userId
    ) {
      return vm;
    }
    current = current.return as Record<string, unknown> | null;
  }
  return null;
}

function readObservable(ob: unknown): unknown {
  if (!ob) return undefined;
  const value = ob as { getValue?: () => unknown; value?: unknown };
  try {
    if (typeof value.getValue === 'function') return value.getValue();
    if ('value' in value) return value.value;
  } catch {
    // ignore
  }
  return undefined;
}

function scanLiveState(doc: Document | undefined): Map<string, LiveTileState> {
  if (!doc) return NO_LIVE_STATE;
  const result = new Map<string, LiveTileState>();

  const tiles = Array.from(doc.querySelectorAll<HTMLElement>('[data-testid="videoTile"]'));
  const screensharers = new Map<string, true>();

  for (const tile of tiles) {
    const vm = findMediaVm(getFiberFromNode(tile));
    if (!vm) continue;
    const userId = vm.userId as unknown;
    if (typeof userId !== 'string' || !userId) continue;

    if ((vm.type as unknown) === 'screen share') {
      screensharers.set(userId, true);
      continue;
    }

    const muted = !readObservable(vm.audioEnabled$);
    const videoMuted = !readObservable(vm.videoEnabled$);
    const speaking = !!readObservable(vm.speaking$);

    result.set(userId, {
      muted,
      videoMuted,
      screensharing: false,
      speaking,
    });
  }

  for (const userId of screensharers.keys()) {
    const prev = result.get(userId);
    result.set(userId, {
      muted: prev?.muted ?? true,
      videoMuted: prev?.videoMuted ?? true,
      screensharing: true,
      speaking: prev?.speaking ?? false,
    });
  }

  return result;
}

export function useElementCallTileVisible(): boolean {
  const embed = useAtomValue(elementCallEmbedAtom);
  const ui = useAtomValue(elementCallUiAtom);
  const active = ui.roomId !== null && !!embed;

  const [tileVisible, setTileVisible] = useState(false);

  useEffect(() => {
    if (!active || !embed) {
      setTileVisible(false);
      return;
    }

    let seen = false;
    const check = (): void => {
      if (seen) return;
      let doc: Document | undefined;
      try {
        doc = embed.document;
      } catch {
        doc = undefined;
      }
      if (doc?.querySelector('[data-testid="videoTile"]')) {
        seen = true;
        setTileVisible(true);
        stop();
      }
    };

    let rafId: number | null = null;
    const schedule = (): void => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        check();
      });
    };

    let observer: MutationObserver | null = null;
    const startObserving = (): void => {
      let doc: Document | undefined;
      try {
        doc = embed.document;
      } catch {
        doc = undefined;
      }
      if (!doc || !doc.body || observer) return;
      observer = new MutationObserver(schedule);
      observer.observe(doc.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class'],
      });
      check();
    };

    const onLoad = (): void => startObserving();
    const interval = window.setInterval(check, 1000);

    const stop = (): void => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.clearInterval(interval);
      observer?.disconnect();
      embed.iframe.removeEventListener('load', onLoad);
    };

    embed.iframe.addEventListener('load', onLoad);
    startObserving();

    return stop;
  }, [active, embed]);

  return tileVisible;
}

export function useElementCallLiveState(roomId: string): Map<string, LiveTileState> {
  const embed = useAtomValue(elementCallEmbedAtom);
  const ui = useAtomValue(elementCallUiAtom);
  const localInCall = ui.roomId === roomId;

  const [liveState, setLiveState] = useState<Map<string, LiveTileState>>(NO_LIVE_STATE);
  const liveStateRef = useRef(liveState);
  liveStateRef.current = liveState;

  const rescan = useCallback(() => {
    if (!embed) return;
    const next = scanLiveState(getEmbedDocument(embed));
    if (next !== NO_LIVE_STATE) {
      const prev = liveStateRef.current;
      let changed = next.size !== prev.size;
      if (!changed) {
        for (const [userId, state] of next) {
          const old = prev.get(userId);
          if (
            !old ||
            old.muted !== state.muted ||
            old.videoMuted !== state.videoMuted ||
            old.screensharing !== state.screensharing ||
            old.speaking !== state.speaking
          ) {
            changed = true;
            break;
          }
        }
      }
      if (changed) {
        setLiveState(next);
      }
    }
  }, [embed]);

  useEffect(() => {
    if (!localInCall || !embed) {
      setLiveState(NO_LIVE_STATE);
      return;
    }

    let rafId: number | null = null;
    const schedule = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        rescan();
      });
    };

    let observer: MutationObserver | null = null;
    const startObserving = () => {
      const doc = getEmbedDocument(embed);
      if (!doc || !doc.body || observer) return;
      observer = new MutationObserver(schedule);
      observer.observe(doc.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class'],
      });
      rescan();
    };

    const onLoad = () => startObserving();
    embed.iframe.addEventListener('load', onLoad);
    startObserving();

    const interval = window.setInterval(rescan, 1000);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.clearInterval(interval);
      observer?.disconnect();
      embed.iframe.removeEventListener('load', onLoad);
    };
  }, [localInCall, embed, rescan, roomId]);

  return liveState;
}

export function useElementCallParticipants(roomId: string): VoiceParticipant[] {
  const client = getMatrixClientOrNull();
  const ui = useAtomValue(elementCallUiAtom);
  const membershipsMap = useElementCallMemberships(client, [roomId]);
  const memberships = useMemo(() => membershipsMap.get(roomId) ?? [], [membershipsMap, roomId]);
  const liveState = useElementCallLiveState(roomId);
  const localInCall = ui.roomId === roomId;

  const participants = useMemo(() => {
    const room = client?.getRoom(roomId) ?? null;
    const myUserId = client?.getUserId();

    const result: VoiceParticipant[] = uniqueMembers(memberships).map((member) => {
      const userId = member.userId;
      const memberInfo = room?.getMember(userId) ?? null;
      const live = liveState.get(userId);
      const isLocal = userId === myUserId;

      return {
        userId,
        name: memberInfo?.name ?? formatUserId(userId),
        mxcAvatar: memberInfo?.getMxcAvatarUrl?.() ?? null,
        muted: localInCall ? (live ? live.muted : isLocal ? ui.isMuted : false) : false,
        videoMuted: localInCall
          ? live
            ? live.videoMuted
            : isLocal
              ? ui.isVideoMuted
              : true
          : true,
        screensharing: localInCall ? (live?.screensharing ?? false) : false,
        speaking: localInCall ? (live?.speaking ?? false) : false,
      };
    });

    return result;
  }, [client, roomId, memberships, liveState, localInCall, ui.isMuted, ui.isVideoMuted]);

  return participants;
}
