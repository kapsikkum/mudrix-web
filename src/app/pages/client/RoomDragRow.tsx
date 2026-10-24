import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { vars } from '@/theme/vars.css';

interface RoomDragRowProps {
  id: string;
  /** Rooms only swap places inside their own group (category and kind). */
  group: string;
  index: number;
  children: React.ReactNode;
}

/**
 * Makes a room row draggable onto another row of the same group. Rows do not move while
 * dragging; the row under the pointer shows a line where the dragged one will land.
 */
export function RoomDragRow({ id, group, index, children }: RoomDragRowProps) {
  const data = { group, index };
  const drag = useDraggable({ id, data });
  const drop = useDroppable({ id, data });
  const { active } = useDndContext();
  const from = active?.data.current as { group: string; index: number } | undefined;
  const target = drop.isOver && from && from.group === group && active?.id !== id;
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
        opacity: drag.isDragging ? 0.45 : 1,
        borderTop: target && from.index > index ? line : undefined,
        borderBottom: target && from.index < index ? line : undefined,
        boxSizing: 'border-box',
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  );
}
