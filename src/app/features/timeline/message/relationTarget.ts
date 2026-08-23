import { EventStatus, MatrixEventEvent } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';

const DEFAULT_TIMEOUT_MS = 10_000;

export function resolveRelationTarget(
  client: MatrixClient,
  roomId: string,
  eventId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string> {
  if (!eventId.startsWith('~')) return Promise.resolve(eventId);

  const room = client.getRoom(roomId);
  const pending = room?.getPendingEvents().find((e) => e.getId() === eventId);
  if (!pending || pending.status === null) {
    return Promise.reject(new Error('relation target is not being sent'));
  }

  const currentId = pending.getId();
  if (currentId?.startsWith('$')) return Promise.resolve(currentId);

  const target: MatrixEvent = pending;
  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const timer = setTimeout(
      () => settle(() => reject(new Error('timed out waiting for the message to be sent'))),
      timeoutMs
    );

    const onReplaced = () => {
      const replaced = target.getId();
      settle(() => {
        if (replaced?.startsWith('$')) resolve(replaced);
        else reject(new Error('failed to resolve the sent message id'));
      });
    };

    const onStatus = (status: EventStatus | null) => {
      if (status === EventStatus.NOT_SENT || status === EventStatus.CANCELLED) {
        settle(() => reject(new Error('the original message failed to send')));
      }
    };

    function cleanup() {
      clearTimeout(timer);
      target.removeListener(MatrixEventEvent.LocalEventIdReplaced, onReplaced);
      target.removeListener(MatrixEventEvent.Status, onStatusListener);
    }

    const onStatusListener = (_event: MatrixEvent, status: EventStatus | null) => onStatus(status);

    target.once(MatrixEventEvent.LocalEventIdReplaced, onReplaced);
    target.on(MatrixEventEvent.Status, onStatusListener);
  });
}
