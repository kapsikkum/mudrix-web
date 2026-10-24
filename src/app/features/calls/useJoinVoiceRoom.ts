import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { elementCallActionsAtom, isInElementCallAtom } from '@/app/store/atoms/elementCall';
import { useConfirm } from '@/app/hooks/useConfirm';
import { activeRoomListStyleAtom } from '@/app/store/atoms/settings';

export function useJoinVoiceRoom(
  client: MatrixClient | null
): (roomId: string, opts?: { skipConfirm?: boolean }) => Promise<void> {
  const { t } = useTranslation();
  const confirmDialog = useConfirm();
  const isInElementCall = useAtomValue(isInElementCallAtom);
  const startCall = useAtomValue(elementCallActionsAtom)?.start;
  const modern = useAtomValue(activeRoomListStyleAtom) === 'modern';

  return useCallback(
    async (roomId: string, opts?: { skipConfirm?: boolean }) => {
      if (!client || !startCall) return;
      const room = client.getRoom(roomId);
      if (!room) return;

      if (isInElementCall && !opts?.skipConfirm) {
        const confirmed = await confirmDialog({
          title: t('room.switchVoiceRoom'),
          message: t('room.switchVoiceRoomMessage'),
          confirmLabel: t('room.switch'),
          cancelLabel: t('common.cancel'),
          cancelPrimary: true,
        });
        if (!confirmed) return;
      }

      // The modern style shows who is connected in the room list, so the call screen stays hidden.
      await startCall(room, { voiceOnly: true, presentation: modern ? 'hidden' : 'room' });
    },
    [client, isInElementCall, startCall, confirmDialog, t, modern]
  );
}
