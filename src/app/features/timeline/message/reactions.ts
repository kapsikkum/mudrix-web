import { useTranslation } from 'react-i18next';
import {
  EventType,
  EventStatus,
  MatrixEvent,
  MatrixEventEvent,
  Method,
  RelationType,
  RoomEvent,
} from 'matrix-js-sdk';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';

const pendingAdds = new Set<string>();
const pendingRedacts = new WeakSet<MatrixEvent>();

async function redactReaction(
  client: MatrixClient,
  roomId: string,
  reactionEvent: MatrixEvent
): Promise<void> {
  const id = reactionEvent.getId();
  if (!id?.startsWith('$')) return;
  const txnId = client.makeTxnId();
  const path = `/rooms/${encodeURIComponent(roomId)}/redact/${encodeURIComponent(id)}/${txnId}`;
  await client.http.authedRequest(Method.Put, path, {}, {});
}

interface RelationsContainerMap {
  relations: Map<string, Map<string, Map<string, { getRelations(): MatrixEvent[] }>>>;
}

function findRelationEventById(room: Room, eventId: string): MatrixEvent | undefined {
  const container = room.relations as unknown as RelationsContainerMap | null;
  if (!container) return undefined;

  for (const relTypeMap of container.relations.values()) {
    for (const eventTypeMap of relTypeMap.values()) {
      for (const relations of eventTypeMap.values()) {
        const hit = relations.getRelations().find((e) => e.getId() === eventId);
        if (hit) return hit;
      }
    }
  }
  return undefined;
}

export function applyRedactionToRelations(room: Room | null, redactionEvent: MatrixEvent): void {
  if (!room || !redactionEvent.isRedaction()) return;
  const targetId = redactionEvent.getAssociatedId();
  if (!targetId) return;
  const target = room.findEventById(targetId) ?? findRelationEventById(room, targetId);
  if (!target || target.isRedacted()) return;
  target.markLocallyRedacted(redactionEvent);
}

function applyLocalRedaction(client: MatrixClient, roomId: string, current: MatrixEvent): void {
  const room = client.getRoom(roomId);
  const id = current.getId();
  if (!room || !id) return;
  const redaction = new MatrixEvent({
    type: 'm.room.redaction',
    room_id: roomId,
    sender: client.getUserId() ?? '',
    redacts: id,
    event_id: `~redaction:${id}`,
  });
  applyRedactionToRelations(room, redaction);
  room.emit(RoomEvent.Redaction, redaction, room);
}

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
    if (rel.isRedacted()) continue;
    if (rel.status === EventStatus.NOT_SENT) continue;
    const relId = rel.getId();
    if (!relId) continue;
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

export async function toggleReaction(
  client: MatrixClient,
  roomId: string,
  messageEvent: MatrixEvent,
  myId: string,
  key: string,
  ownEventId: string | null
): Promise<void> {
  const room = client.getRoom(roomId);
  const bucket = room?.relations?.getChildEventsForEvent(
    messageEvent.getId() ?? '',
    'm.annotation',
    'm.reaction'
  );
  const ownRelations =
    bucket?.getRelations().filter((e) => e.getSender() === myId && !e.isRedacted()) ?? [];
  const current =
    ownRelations.find((e) => ownEventId != null && e.getId() === ownEventId) ??
    ownRelations.find((e) => {
      const content = e.getContent() as Record<string, unknown>;
      const rel = content?.['m.relates_to'] as Record<string, unknown> | undefined;
      return rel?.key === key;
    });

  if (current) {
    if (pendingRedacts.has(current)) return;
    const id = current.getId();

    if (id?.startsWith('$')) {
      pendingRedacts.add(current);
      try {
        await redactReaction(client, roomId, current);
        applyLocalRedaction(client, roomId, current);
      } finally {
        pendingRedacts.delete(current);
      }
      return;
    }

    if (
      current.status === EventStatus.QUEUED ||
      current.status === EventStatus.NOT_SENT ||
      current.status === EventStatus.ENCRYPTING
    ) {
      pendingRedacts.add(current);
      try {
        client.cancelPendingEvent(current);
      } catch {
        // event may already be gone
      } finally {
        pendingRedacts.delete(current);
      }
      return;
    }

    if (current.status === EventStatus.SENDING) {
      pendingRedacts.add(current);
      const settle = () => pendingRedacts.delete(current);
      current.once(MatrixEventEvent.LocalEventIdReplaced, () => {
        const replacedId = current.getId();
        if (replacedId?.startsWith('$')) {
          redactReaction(client, roomId, current)
            .then(() => applyLocalRedaction(client, roomId, current))
            .catch(() => {})
            .finally(settle);
        } else {
          settle();
        }
      });
      current.once(MatrixEventEvent.Status, (_event, status) => {
        if (status === EventStatus.NOT_SENT || status === EventStatus.CANCELLED) settle();
      });
      return;
    }

    return;
  }

  const addKey = `${messageEvent.getId() ?? ''}:${key}`;
  if (pendingAdds.has(addKey)) return;
  pendingAdds.add(addKey);
  try {
    await client.sendEvent(roomId, EventType.Reaction, {
      'm.relates_to': {
        rel_type: RelationType.Annotation,
        event_id: messageEvent.getId() ?? '',
        key,
      },
    });
  } finally {
    pendingAdds.delete(addKey);
  }
}

export function useReactionHandler(event: MatrixEvent, client: MatrixClient) {
  const { t } = useTranslation();
  const toast = useToast();

  return async (r: Reaction) => {
    const roomId = event.getRoomId() ?? '';
    const myId = client.getUserId() ?? '';
    try {
      await toggleReaction(client, roomId, event, myId, r.key, r.ownEventId);
    } catch (err) {
      toast.error(t('timeline.reactFailed', { error: getErrorMessage(err) }));
    }
  };
}
