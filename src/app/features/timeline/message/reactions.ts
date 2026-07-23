import { useTranslation } from 'react-i18next';
import { EventType, RelationType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';

export interface Reaction {
  key: string;
  count: number;
  isOwn: boolean;
  ownEventId: string | null;
  shortcode?: string;
}

export function buildReactionMap(
  room: Room | null,
  event: MatrixEvent,
  myId: string
): Map<string, Reaction> {
  const reactionMap = new Map<string, Reaction>();
  if (!room) return reactionMap;

  const relations = room.relations?.getChildEventsForEvent(
    event.getId() ?? '',
    'm.annotation',
    'm.reaction'
  );
  if (!relations) return reactionMap;

  for (const rel of relations.getRelations()) {
    const relId = rel.getId();
    if (!relId?.startsWith('$')) continue;
    const relContent = rel.getContent() as Record<string, unknown>;
    const key: string =
      ((relContent?.['m.relates_to'] as Record<string, unknown>)?.key as string) ?? '';
    if (!key) continue;
    const shortcode = relContent?.shortcode as string | undefined;
    const existing = reactionMap.get(key) ?? {
      key,
      shortcode,
      count: 0,
      isOwn: false,
      ownEventId: null,
    };
    existing.count++;
    if (rel.getSender() === myId) {
      existing.isOwn = true;
      existing.ownEventId = relId;
    }
    reactionMap.set(key, existing);
  }

  return reactionMap;
}

export function useReactionHandler(event: MatrixEvent, client: MatrixClient) {
  const { t } = useTranslation();
  const toast = useToast();

  return async (r: Reaction) => {
    const roomId = event.getRoomId() ?? '';
    try {
      if (r.isOwn && r.ownEventId) {
        await client.redactEvent(roomId, r.ownEventId);
      } else {
        await client.sendEvent(roomId, EventType.Reaction, {
          'm.relates_to': {
            rel_type: RelationType.Annotation,
            event_id: event.getId() ?? '',
            key: r.key,
          },
        });
      }
    } catch (err) {
      toast.error(t('timeline.reactFailed', { error: getErrorMessage(err) }));
    }
  };
}
