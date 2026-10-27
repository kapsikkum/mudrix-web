import { useCallback, useEffect, useState } from 'react';
import { ClientEvent, MatrixEvent } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

// "Remind me" reminders live in account data, so they follow the account to every device. Like
// saved messages they store only room and event ids: the server never sees message text.
const REMINDERS_TYPE = 'chat.mudrix.reminders';

export interface Reminder {
  id: string;
  roomId: string;
  eventId: string;
  /** Epoch ms when it is due. */
  at: number;
}

interface RemindersContent {
  items?: Reminder[];
}

type AccountDataClient = {
  getAccountData(type: string): { getContent(): unknown } | undefined;
  setAccountData(type: string, content: object): Promise<unknown>;
};

const dataClient = (client: MatrixClient) => client as unknown as AccountDataClient;

/** Every reminder that is not delivered yet, soonest first. */
export function getReminders(client: MatrixClient): Reminder[] {
  const content = dataClient(client).getAccountData(REMINDERS_TYPE)?.getContent() as
    | RemindersContent
    | undefined;
  const items = Array.isArray(content?.items) ? content.items : [];
  return items
    .filter(
      (r) =>
        typeof r?.id === 'string' &&
        typeof r.roomId === 'string' &&
        typeof r.eventId === 'string' &&
        typeof r.at === 'number'
    )
    .sort((a, b) => a.at - b.at);
}

export async function addReminder(
  client: MatrixClient,
  roomId: string,
  eventId: string,
  at: number
): Promise<Reminder> {
  const reminder: Reminder = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    eventId,
    at,
  };
  await dataClient(client).setAccountData(REMINDERS_TYPE, {
    items: [...getReminders(client), reminder],
  });
  return reminder;
}

/** Removes a reminder; false when it was already gone (another device delivered or cancelled it). */
export async function removeReminder(client: MatrixClient, id: string): Promise<boolean> {
  const current = getReminders(client);
  if (!current.some((r) => r.id === id)) return false;
  await dataClient(client).setAccountData(REMINDERS_TYPE, {
    items: current.filter((r) => r.id !== id),
  });
  return true;
}

/** The pending reminders, kept up to date as account data changes. */
export function useReminders(client: MatrixClient | null): Reminder[] {
  const [items, setItems] = useState<Reminder[]>(() => (client ? getReminders(client) : []));
  const refresh = useCallback(() => {
    if (client) setItems(getReminders(client));
  }, [client]);
  useEffect(refresh, [refresh]);
  useMatrixEvent(client, ClientEvent.AccountData, (event: MatrixEvent) => {
    if (event.getType() === REMINDERS_TYPE) refresh();
  });
  return items;
}

export type ReminderPreset = 'in20m' | 'in1h' | 'in3h' | 'tomorrow';

export const REMINDER_PRESETS: ReminderPreset[] = ['in20m', 'in1h', 'in3h', 'tomorrow'];

/** When a preset falls due, relative to `now`. "Tomorrow" is 9:00 the next morning, local time. */
export function reminderTime(preset: ReminderPreset, now: number = Date.now()): number {
  switch (preset) {
    case 'in20m':
      return now + 20 * 60_000;
    case 'in1h':
      return now + 60 * 60_000;
    case 'in3h':
      return now + 3 * 60 * 60_000;
    default: {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      return next.getTime();
    }
  }
}

/** "3:40 PM", or "Tue 9:00 AM" when it is not today. */
export function formatReminderTime(at: number, locale: string, now: number = Date.now()): string {
  const date = new Date(at);
  const sameDay = new Date(now).toDateString() === date.toDateString();
  return new Intl.DateTimeFormat(locale, {
    ...(sameDay ? {} : { weekday: 'short' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
