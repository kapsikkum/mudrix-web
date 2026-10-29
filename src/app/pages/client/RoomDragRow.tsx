import { useEffect, useState } from 'react';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { vars } from '@/theme/vars.css';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { canMoveUserBetween } from '@/app/features/voice/voiceMove';

interface RoomDragRowProps {
  id: string;
  /** Rooms only swap places inside their own group (category and kind). */
  group: string;
  index: number;
  /** A voice channel can be dropped onto by a person being moved. */
  isVoice?: boolean;
  children: React.ReactNode;
}

/**
 * Makes a room row draggable onto another row of the same group. Rows do not move while
 * dragging; the row under the pointer shows a line where the dragged one will land.
 */
export function RoomDragRow({ id, group, index, isVoice, children }: RoomDragRowProps) {
  const data = { group, index };
  const drag = useDraggable({ id, data });
  const { active } = useDndContext();
  const from = active?.data.current as
    | { kind?: string; group: string; index: number; fromRoomId?: string; userId?: string }
    | undefined;
  // A voice channel the person being moved can't be sent to (they are not in it, or the mover may
  // not move people there) greys out and takes no drop.
  const client = getMatrixClientOrNull();
  // Members load lazily, so who is in this channel is only known once asked for.
  const [, setMembersLoaded] = useState(false);
  const personDragged = from?.kind === 'participant' && !!isVoice;
  useEffect(() => {
    if (!personDragged) return;
    client
      ?.getRoom(id)
      ?.loadMembersIfNeeded()
      .then(() => setMembersLoaded((v) => !v))
      .catch(() => {});
  }, [personDragged, client, id]);
  const blocked =
    from?.kind === 'participant' &&
    !!isVoice &&
    from.fromRoomId !== id &&
    !!client &&
    !!from.userId &&
    !!from.fromRoomId &&
    !canMoveUserBetween(client, client.getSafeUserId(), from.userId, from.fromRoomId, id);
  const drop = useDroppable({ id, data, disabled: blocked });
  const target = drop.isOver && from && from.group === group && active?.id !== id;
  // A person being moved lands on a voice channel other than the one they are in.
  const personTarget =
    drop.isOver && from?.kind === 'participant' && isVoice && from.fromRoomId !== id && !blocked;
  const line = `2px solid ${vars.color.accent}`;

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      {...drag.listeners}
      style={{
        height: '100%',
        opacity: drag.isDragging ? 0.45 : blocked ? 0.3 : 1,
        cursor: blocked ? 'not-allowed' : undefined,
        borderTop: target && from.index > index ? line : undefined,
        borderBottom: target && from.index < index ? line : undefined,
        boxSizing: 'border-box',
        outline: personTarget ? `2px solid ${vars.color.accent}` : undefined,
        outlineOffset: '-2px',
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  );
}
