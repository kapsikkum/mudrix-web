import { useCallback, useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { playVoiceSound } from '@/app/features/voice/voiceSounds';
import type { VoiceRefs } from './types';
import { VOICE_STATE_TYPE } from './types';

export function useVoiceMatrixState(
  client: MatrixClient | null,
  activeRoomId: string | null,
  voiceStateKey: () => string,
  voiceStateCacheRef: VoiceRefs['voiceStateCacheRef'],
  readyRef: VoiceRefs['readyRef'],
  refreshParticipants: (roomId: string) => void
) {
  const pushVoiceState = useCallback(
    (roomId: string, updates: Record<string, unknown>) => {
      if (!client) return;
      voiceStateCacheRef.current = { ...voiceStateCacheRef.current, ...updates };
      client
        .sendStateEvent(
          roomId,
          VOICE_STATE_TYPE as UntypedStateEventType,
          voiceStateCacheRef.current as RawStateContent,
          voiceStateKey()
        )
        .catch(() => {});
    },
    [client, voiceStateCacheRef, voiceStateKey]
  );

  useEffect(() => {
    const handleUnload = () => {
      if (!client || !activeRoomId) return;

      const baseUrl = client.baseUrl;
      const accessToken = client.getAccessToken();
      const deviceKey = voiceStateKey();
      if (!accessToken || !deviceKey) return;

      const encodedRoom = encodeURIComponent(activeRoomId);
      const encodedType = encodeURIComponent(VOICE_STATE_TYPE);
      const encodedKey = encodeURIComponent(deviceKey);
      const url = `${baseUrl}/_matrix/client/v3/rooms/${encodedRoom}/state/${encodedType}/${encodedKey}`;

      fetch(url, {
        method: 'PUT',
        keepalive: true,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ participating: false }),
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [client, activeRoomId, voiceStateKey]);

  const handleVoiceStateEvent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      if (event.getType?.() !== VOICE_STATE_TYPE) return;
      if (event.getRoomId?.() !== activeRoomId) return;

      const content = event.getContent?.() ?? {};
      const prev = event.getPrevContent?.() ?? {};

      const isOwnEvent = event.getSender?.() === client?.getUserId();
      if (!isOwnEvent && readyRef.current && content.participating) {
        if (prev.video_muted !== false && content.video_muted === false) {
          playVoiceSound('camera-on');
        }
      }

      if (activeRoomId) refreshParticipants(activeRoomId);
    },
    [client, activeRoomId, readyRef, refreshParticipants]
  );

  useMatrixEvent(client, 'RoomState.events', handleVoiceStateEvent);

  return { pushVoiceState };
}
