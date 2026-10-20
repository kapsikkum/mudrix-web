import { useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';

// MSC4140 delayed events ("send later"). The SDK helpers are all `_unstable_*` and require
// the homeserver to advertise `org.matrix.msc4140` in /versions unstable_features.
const MSC4140_FEATURE = 'org.matrix.msc4140';

export interface ScheduledMessage {
  delayId: string;
  roomId: string;
  body: string;
  /** Epoch ms at which the server will send the event (null when chained to a parent delay). */
  sendAt: number | null;
}

const supportCache = new WeakMap<MatrixClient, Promise<boolean>>();

export function supportsDelayedEvents(client: MatrixClient): Promise<boolean> {
  const cached = supportCache.get(client);
  if (cached) return cached;
  const probe = client.doesServerSupportUnstableFeature(MSC4140_FEATURE).catch(() => false);
  supportCache.set(client, probe);
  return probe;
}

export function useDelayedEventsSupport(client: MatrixClient): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    supportsDelayedEvents(client).then((value) => {
      if (!cancelled) setSupported(value);
    });
    return () => {
      cancelled = true;
    };
  }, [client]);
  return supported;
}

/**
 * Delayed events are not end-to-end encrypted by the SDK (the server has to send the plaintext
 * event later), so they must never be used in encrypted rooms.
 */
export function canScheduleInRoom(client: MatrixClient, roomId: string): boolean {
  return !client.getRoom(roomId)?.hasEncryptionStateEvent();
}

export async function scheduleMessage(
  client: MatrixClient,
  roomId: string,
  threadId: string | null | undefined,
  content: Record<string, unknown>,
  delayMs: number
): Promise<string> {
  const res = await client._unstable_sendDelayedEvent(
    roomId,
    { delay: Math.round(delayMs) },
    threadId ?? null,
    EventType.RoomMessage,
    content as unknown as RoomMessageEventContent
  );
  return res.delay_id;
}

export async function listScheduledMessages(
  client: MatrixClient,
  roomId: string
): Promise<ScheduledMessage[]> {
  const res = await client._unstable_getDelayedEvents('scheduled');
  const items = res.scheduled ?? [];
  return items
    .filter((item) => item.room_id === roomId && item.type === EventType.RoomMessage)
    .map((item) => {
      const body = (item.content as { body?: unknown } | undefined)?.body;
      return {
        delayId: item.delay_id,
        roomId: item.room_id,
        body: typeof body === 'string' ? body : '',
        sendAt:
          'delay' in item &&
          typeof item.delay === 'number' &&
          typeof item.running_since === 'number'
            ? item.running_since + item.delay
            : null,
      };
    })
    .sort((a, b) => (a.sendAt ?? Infinity) - (b.sendAt ?? Infinity));
}

export function cancelScheduledMessage(client: MatrixClient, delayId: string): Promise<unknown> {
  return client._unstable_cancelScheduledDelayedEvent(delayId);
}

export function sendScheduledMessageNow(client: MatrixClient, delayId: string): Promise<unknown> {
  return client._unstable_sendScheduledDelayedEvent(delayId);
}
