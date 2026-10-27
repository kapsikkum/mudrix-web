import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { formatUserId, getDmPartnerId } from '@/util/matrix';
import { getErrorMessage } from '@/util/error';
import { formatReminderTime, removeReminder, useReminders } from '@/util/reminders';
import * as layoutCss from '../Settings.css';
import * as css from './Notifications.css';

/** The reminders set with "Remind me" on messages that have not gone off yet. */
export function RemindersList() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const client = getMatrixClientOrNull();
  const reminders = useReminders(client);

  const roomLabel = (roomId: string): string => {
    const room = client?.getRoom(roomId);
    if (!room || !client) return roomId;
    const partner = getDmPartnerId(room, client);
    return partner ? (room.getMember(partner)?.name ?? formatUserId(partner)) : room.name;
  };

  return (
    <div className={layoutCss.section}>
      <h3 className={layoutCss.sectionTitle}>{t('settings.notifications.reminders.title')}</h3>
      {reminders.length === 0 ? (
        <p className={`${layoutCss.settingNote} ${css.keywordEmpty}`}>
          {t('settings.notifications.reminders.empty')}
        </p>
      ) : (
        <ul className={css.keywordList}>
          {reminders.map((reminder) => (
            <li key={reminder.id} className={css.keywordItem}>
              <span className={css.keywordText}>
                {t('settings.notifications.reminders.entry', {
                  room: roomLabel(reminder.roomId),
                  time: formatReminderTime(reminder.at, i18n.language),
                })}
              </span>
              <button
                type="button"
                className={css.keywordDel}
                onClick={() => {
                  if (!client) return;
                  removeReminder(client, reminder.id).catch((err) =>
                    toast.error(t('timeline.remind.failed', { error: getErrorMessage(err) }))
                  );
                }}
                aria-label={t('settings.notifications.reminders.cancel')}
              >
                <XIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
