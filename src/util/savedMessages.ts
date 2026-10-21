import { useCallback, useEffect, useState } from 'react';
import { ClientEvent, MatrixEvent } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

// Saved messages live in account data, so they follow the account to every device. Only room and
// event ids are stored: the server never sees the text of a saved (possibly encrypted) message.
const SAVED_TYPE = 'io.mudrix.saved_messages';

export interface SavedMessage {
  roomId: string;
  eventId: string;
  savedAt: number;
}

interface SavedContent {
  items?: SavedMessage[];
}

type AccountDataClient = {
  getAccountData(type: string): { getContent(): unknown } | undefined;
  setAccountData(type: string, content: object): Promise<unknown>;
};

const dataClient = (client: MatrixClient) => client as unknown as AccountDataClient;

export function getSavedMessages(client: MatrixClient): SavedMessage[] {
  const content = dataClient(client).getAccountData(SAVED_TYPE)?.getContent() as
    | SavedContent
    | undefined;
  const items = Array.isArray(content?.items) ? content.items : [];
  return items.filter((i) => typeof i?.roomId === 'string' && typeof i?.eventId === 'string');
}

export function isMessageSaved(client: MatrixClient, eventId: string): boolean {
  return getSavedMessages(client).some((i) => i.eventId === eventId);
}

/** Saves the message, or removes it from the saved list when it already is there. */
export async function toggleSavedMessage(
  client: MatrixClient,
  roomId: string,
  eventId: string
): Promise<boolean> {
  const current = getSavedMessages(client);
  const saved = current.some((i) => i.eventId === eventId);
  const next = saved
    ? current.filter((i) => i.eventId !== eventId)
    : [{ roomId, eventId, savedAt: Date.now() }, ...current];
  await dataClient(client).setAccountData(SAVED_TYPE, { items: next });
  return !saved;
}

/** The saved list, newest first, kept up to date as account data changes. */
export function useSavedMessages(client: MatrixClient | null): SavedMessage[] {
  const [items, setItems] = useState<SavedMessage[]>(() =>
    client ? getSavedMessages(client) : []
  );
  const refresh = useCallback(() => {
    if (client) setItems(getSavedMessages(client));
  }, [client]);
  useEffect(refresh, [refresh]);
  useMatrixEvent(client, ClientEvent.AccountData, refresh);
  return items;
}

/** Looks a saved message up locally, falling back to fetching (and decrypting) it. */
export async function resolveSavedEvent(
  client: MatrixClient,
  saved: SavedMessage
): Promise<MatrixEvent | null> {
  const local = client.getRoom(saved.roomId)?.findEventById(saved.eventId);
  if (local) return local;
  try {
    const raw = await client.fetchRoomEvent(saved.roomId, saved.eventId);
    const event = new MatrixEvent(raw);
    await client.decryptEventIfNeeded(event);
    return event;
  } catch {
    return null;
  }
}
