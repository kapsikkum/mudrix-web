import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { jumpRequestAtom } from '@/app/store/atoms';
import { useSyncReady } from '@/app/hooks/useSync';
import { useToast } from '@/app/hooks/useToast';
import { showBrowserNotification } from '@/app/hooks/useNotifications';
import { stripReplyFallback } from '@/app/features/timeline/message/textContent';
import { formatUserId, getDmPartnerId } from '@/util/matrix';
import { resolveSavedEvent } from '@/util/savedMessages';
import { removeReminder, useReminders, type Reminder } from '@/util/reminders';

const MAX_TIMEOUT_MS = 2 ** 31 - 1;
const TOAST_MS = 20_000;

/**
 * Delivers "Remind me" reminders when they fall due: a notification (when the window is in the
 * background), a toast that jumps to the message, and the reminder is removed so that no other
 * device repeats it. Reminders that came due while the app was closed are delivered at start-up.
 */
export function useReminderDelivery(client: MatrixClient | null): void {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const setJumpRequest = useSetAtom(jumpRequestAtom);
  const syncReady = useSyncReady();
  const reminders = useReminders(client);
  const delivering = useRef(new Set<string>());
  // Re-runs the effect when a timer that was cut short (very distant reminder) fires early.
  const [tick, setTick] = useState(0);

  const deliver = useCallback(
    async (reminder: Reminder) => {
      if (!client || delivering.current.has(reminder.id)) return;
      delivering.current.add(reminder.id);
      try {
        // Whoever removes it first delivers it; a device that finds it gone stays quiet.
        if (!(await removeReminder(client, reminder.id))) return;
      } catch {
        // Offline: try again on the next change or start-up.
        delivering.current.delete(reminder.id);
        return;
      }

      const room = client.getRoom(reminder.roomId);
      const partner = room ? getDmPartnerId(room, client) : null;
      const roomName = room
        ? partner
          ? (room.getMember(partner)?.name ?? formatUserId(partner))
          : (room.name ?? reminder.roomId)
        : reminder.roomId;
      const event = await resolveSavedEvent(client, { ...reminder, savedAt: 0 });
      const content =
        event && !event.isRedacted() ? (event.getClearContent() ?? event.getContent()) : null;
      const text =
        typeof content?.body === 'string'
          ? stripReplyFallback(content.body).split('\n')[0].trim().slice(0, 140)
          : '';
      const summary = text ? `${roomName}: ${text}` : roomName;

      const route = `${partner ? '/dm/' : '/r/'}${encodeURIComponent(reminder.roomId)}`;
      const open = () => {
        setJumpRequest({ roomId: reminder.roomId, eventId: reminder.eventId });
        navigate(route);
      };
      toast.info(`${t('reminders.title')}: ${summary}`, {
        duration: TOAST_MS,
        actionLabel: t('reminders.open'),
        onClick: open,
      });
      if (document.hidden || !document.hasFocus()) {
        void showBrowserNotification(t('reminders.title'), summary, route);
      }
    },
    [client, navigate, setJumpRequest, t, toast]
  );

  useEffect(() => {
    if (!client || !syncReady || reminders.length === 0) return undefined;
    const now = Date.now();
    reminders.filter((r) => r.at <= now).forEach((r) => void deliver(r));
    const next = reminders.find((r) => r.at > now);
    if (!next) return undefined;
    const timer = setTimeout(
      () => {
        if (Date.now() >= next.at - 1000) void deliver(next);
        else setTick((n) => n + 1);
      },
      Math.min(next.at - now, MAX_TIMEOUT_MS)
    );
    return () => clearTimeout(timer);
  }, [client, syncReady, reminders, deliver, tick]);
}
