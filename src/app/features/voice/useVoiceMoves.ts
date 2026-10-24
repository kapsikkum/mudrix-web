import { useRef } from 'react';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { MatrixEventEvent, type MatrixClient, type MatrixEvent, type Room } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useToast } from '@/app/hooks/useToast';
import { allowVoiceMovesAtom } from '@/app/store/atoms/settings';
import { elementCallUiAtom } from '@/app/store/atoms/elementCall';
import { isVoiceRoom } from '@/util/matrix';
import { VOICE_MOVE_EVENT_TYPE, mayMoveBetween, type VoiceMoveContent } from './voiceMove';

/** Requests older than this are ignored, so a move is never replayed after a reload. */
const MAX_AGE_MS = 60_000;

/**
 * Follows a request from someone who manages the space to join another voice channel. Only acts when
 * this person is in that call, the sender manages a space containing both channels, and the setting
 * is on.
 */
export function useVoiceMoves(
  client: MatrixClient | null,
  join: (roomId: string, opts?: { skipConfirm?: boolean }) => Promise<void>
): void {
  const { t } = useTranslation();
  const toast = useToast();
  const allowed = useAtomValue(allowVoiceMovesAtom);
  const callRoomId = useAtomValue(elementCallUiAtom).roomId;
  const seen = useRef(new Set<string>());

  const consider = (event: MatrixEvent, room: Room) => {
    if (!client) return;
    if (event.getType() !== VOICE_MOVE_EVENT_TYPE) return;
    const id = event.getId();
    if (!id || !id.startsWith('$') || seen.current.has(id)) return;
    seen.current.add(id);

    const content = event.getContent() as Partial<VoiceMoveContent>;
    const me = client.getUserId();
    const sender = event.getSender();
    if (!me || !sender || content.user_id !== me || typeof content.to_room_id !== 'string') return;
    if (Date.now() - event.getTs() > MAX_AGE_MS) return;
    if (!allowed || callRoomId !== room.roomId) return;

    const target = client.getRoom(content.to_room_id);
    if (!target || target.getMyMembership() !== 'join' || !isVoiceRoom(target)) return;
    if (!mayMoveBetween(client, sender, room.roomId, target.roomId)) return;

    const by = room.getMember(sender)?.name ?? sender;
    toast.info(t('voice.movedBy', { room: target.name, name: by }));
    void join(target.roomId, { skipConfirm: true });
  };
  const considerRef = useRef(consider);
  considerRef.current = consider;

  useMatrixEvent(
    client,
    'Room.timeline',
    (
      event: MatrixEvent,
      room: Room | undefined,
      _toStart: boolean,
      _removed: boolean,
      data?: { liveEvent?: boolean }
    ) => {
      if (!room || !data?.liveEvent) return;
      // In an encrypted voice channel the request is still ciphertext here; look again once it
      // has been decrypted.
      if (event.isBeingDecrypted() || event.shouldAttemptDecryption()) {
        event.once(MatrixEventEvent.Decrypted, () => considerRef.current(event, room));
        return;
      }
      consider(event, room);
    }
  );
}
