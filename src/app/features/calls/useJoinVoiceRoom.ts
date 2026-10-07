import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { elementCallActionsAtom, isInElementCallAtom } from '@/app/store/atoms/elementCall';
import { useConfirm } from '@/app/hooks/useConfirm';

export function useJoinVoiceRoom(client: MatrixClient | null): (roomId: string) => Promise<void> {
  const { t } = useTranslation();
  const confirmDialog = useConfirm();
  const isInElementCall = useAtomValue(isInElementCallAtom);
  const startCall = useAtomValue(elementCallActionsAtom)?.start;

  return useCallback(
    async (roomId: string) => {
      if (!client || !startCall) return;
      const room = client.getRoom(roomId);
      if (!room) return;

      if (isInElementCall) {
        const confirmed = await confirmDialog({
          title: t('room.switchVoiceRoom'),
          message: t('room.switchVoiceRoomMessage'),
          confirmLabel: t('room.switch'),
          cancelLabel: t('common.cancel'),
          cancelPrimary: true,
        });
        if (!confirmed) return;
      }

      await startCall(room, { voiceOnly: true, presentation: 'room' });
    },
    [client, isInElementCall, startCall, confirmDialog, t]
  );
}
