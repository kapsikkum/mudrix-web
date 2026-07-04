import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixEvent } from 'matrix-js-sdk';
import { reevalNowAtom, voiceStateAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { roomState } from '@/util/matrix';
import { PARTICIPANT_TTL_MS, VOICE_STATE_TYPE } from '@/app/hooks/voice/types';

export function useVoiceParticipantCounts(roomIds: string[]): Map<string, number> {
  const client = getMatrixClientOrNull();
  const reevalNow = useAtomValue(reevalNowAtom);
  const voiceState = useAtomValue(voiceStateAtom);

  const roomIdsKey = useMemo(() => roomIds.join('|'), [roomIds]);

  const build = useCallback((): Map<string, number> => {
    const map = new Map<string, number>();
    if (!client) return map;

    for (const roomId of roomIds) {
      const room = client.getRoom(roomId);
      if (!room) continue;

      let events = roomState(room).getStateEvents(VOICE_STATE_TYPE) ?? [];
      if (!Array.isArray(events)) events = [events];

      const seen = new Set<string>();
      let count = 0;
      for (const ev of events) {
        const content = ev.getContent();
        const uid = ev.getSender() ?? '';
        if (!uid || !content?.participating || seen.has(uid)) continue;
        seen.add(uid);

        const ts: number | undefined = content.last_seen ?? content.joined_at;
        if (ts && Date.now() - ts > PARTICIPANT_TTL_MS) continue;

        count++;
      }
      if (count > 0) map.set(roomId, count);
    }

    if (voiceState.roomId && voiceState.participants.length > 0) {
      const stateCount = map.get(voiceState.roomId) ?? 0;
      map.set(voiceState.roomId, Math.max(stateCount, voiceState.participants.length));
    }

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, roomIdsKey, voiceState.roomId, voiceState.participants.length]);

  const [counts, setCounts] = useState<Map<string, number>>(build);

  const handleEvent = useCallback(
    (event: MatrixEvent) => {
      if (event.getType() !== VOICE_STATE_TYPE) return;
      const rid = event.getRoomId();
      if (!rid) return;
      if (!roomIdsKey.split('|').includes(rid)) return;
      setCounts(build());
    },
    [build, roomIdsKey]
  );

  useMatrixEvent(client, 'RoomState.events', handleEvent);

  useEffect(() => {
    setCounts(build());
  }, [build, reevalNow]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setCounts(build());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [build]);

  return counts;
}
