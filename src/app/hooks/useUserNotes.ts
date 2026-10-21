import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useMatrixEvent } from './useMatrixEvent';

/**
 * Private per-user notes, Discord-style: text only you can see, synced via account data
 * (not a room event) so it follows your account across devices and is never sent to the
 * person it's about.
 */
const USER_NOTES_ACCOUNT_DATA = 'chat.mudrix.user_notes';
const MAX_NOTE_LENGTH = 1000;
const SAVE_DEBOUNCE_MS = 600;

type WritableAccountDataEventKey = Parameters<MatrixClient['setAccountData']>[0];

function parseNotes(content: unknown): Record<string, string> {
  if (!content || typeof content !== 'object') return {};
  const notes = (content as Record<string, unknown>).notes;
  if (!notes || typeof notes !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [userId, value] of Object.entries(notes as Record<string, unknown>)) {
    if (typeof value === 'string' && value) out[userId] = value.slice(0, MAX_NOTE_LENGTH);
  }
  return out;
}

export function useUserNotes(client: MatrixClient | null | undefined): {
  getNote: (userId: string) => string;
  saveNote: (userId: string, note: string) => void;
} {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const latestRef = useRef<Record<string, string>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!client) {
      setNotes({});
      latestRef.current = {};
      return;
    }
    const event = client.getAccountData(USER_NOTES_ACCOUNT_DATA as WritableAccountDataEventKey);
    const parsed = parseNotes(event?.getContent());
    latestRef.current = parsed;
    setNotes(parsed);
  }, [client]);

  useMatrixEvent(client, 'accountData', (event: MatrixEvent) => {
    if (event.getType() !== USER_NOTES_ACCOUNT_DATA) return;
    const parsed = parseNotes(event.getContent());
    latestRef.current = parsed;
    setNotes(parsed);
  });

  const getNote = useCallback((userId: string) => notes[userId] ?? '', [notes]);

  const saveNote = useCallback(
    (userId: string, note: string) => {
      if (!client) return;
      const trimmed = note.slice(0, MAX_NOTE_LENGTH);
      setNotes((prev) => {
        const next = { ...prev };
        if (trimmed) next[userId] = trimmed;
        else delete next[userId];
        latestRef.current = next;
        return next;
      });

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        client
          .setAccountData(USER_NOTES_ACCOUNT_DATA as WritableAccountDataEventKey, {
            notes: latestRef.current,
          })
          .catch(() => {});
      }, SAVE_DEBOUNCE_MS);
    },
    [client]
  );

  return { getNote, saveNote };
}
