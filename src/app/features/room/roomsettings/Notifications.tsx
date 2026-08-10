import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BellIcon, BellSlashIcon, AtIcon } from '@phosphor-icons/react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getNotifLevel, setNotifLevel } from '@/app/hooks/useNotifications';
import type { NotifLevel } from '@/app/hooks/useNotifications';
import { getErrorMessage } from '@/util/error';
import * as css from '@/app/components/Settings/Settings.css';

interface NotificationsPanelProps {
  roomId: string;
}

export function NotificationsPanel({ roomId }: NotificationsPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: level = 'all' } = useQuery({
    queryKey: ['notif-level', roomId],
    queryFn: () => {
      if (!client) return Promise.resolve('all' as NotifLevel);
      return getNotifLevel(client, roomId);
    },
    enabled: !!client,
    staleTime: 60_000,
  });

  const handleChange = async (newLevel: NotifLevel) => {
    if (!client) return;
    setSaving(true);
    queryClient.setQueryData(['notif-level', roomId], newLevel);
    try {
      await setNotifLevel(client, roomId, newLevel);
      toast.success(t('room.settings.notifications.updated'));
    } catch (err) {
      toast.error(t('room.settings.notifications.updateFailed', { error: getErrorMessage(err) }));
    } finally {
      queryClient.invalidateQueries({ queryKey: ['notif-level', roomId] });
      setSaving(false);
    }
  };

  const options: {
    value: NotifLevel;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: 'all',
      label: t('room.settings.notifications.all'),
      icon: <BellIcon size={14} />,
    },
    {
      value: 'mentions',
      label: t('room.settings.notifications.mentions'),
      icon: <AtIcon size={14} />,
    },
    {
      value: 'mute',
      label: t('room.settings.notifications.mute'),
      icon: <BellSlashIcon size={14} />,
    },
  ];

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.notifications.title')}</h2>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.notifications.level')}</h3>
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`${css.settingRow} ${saving ? css.settingRowClickDisabled : css.settingRowClickable}`}
            onClick={() => !saving && handleChange(opt.value)}
          >
            <div className={css.settingInfo}>
              <span className={`${css.settingLabel} ${css.flexRow}`}>
                {opt.icon}
                {opt.label}
              </span>
            </div>
            <div
              className={`${css.radioCircle} ${level === opt.value ? css.radioCircleSelected : ''}`}
            >
              {level === opt.value && <div className={css.radioCircleDot} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
