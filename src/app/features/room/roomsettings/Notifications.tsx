import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { vars } from '@/theme/vars.css';
import { BellIcon, BellSlashIcon, AtIcon } from '@phosphor-icons/react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getNotifLevel, setNotifLevel } from '@/app/hooks/useNotifications';
import type { NotifLevel } from '@/app/hooks/useNotifications';
import { getErrorMessage } from '@/util/error';
import * as css from './RoomSettings.css';

interface NotificationsPanelProps {
  roomId: string;
}

export function NotificationsPanel({ roomId }: NotificationsPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const [level, setLevel] = useState<NotifLevel>('all');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) return;
    getNotifLevel(client, roomId).then(setLevel);
  }, [client, roomId]);

  const handleChange = async (newLevel: NotifLevel) => {
    if (!client) return;
    setLevel(newLevel);
    setSaving(true);
    try {
      await setNotifLevel(client, roomId, newLevel);
      toast.success(t('room.settings.notifications.updated'));
    } catch (err) {
      toast.error(t('room.settings.notifications.updateFailed', { error: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  };

  const options: {
    value: NotifLevel;
    label: string;
    icon: React.ReactNode;
    description: string;
  }[] = [
    {
      value: 'all',
      label: t('room.settings.notifications.all'),
      icon: <BellIcon size={14} />,
      description: t('room.settings.notifications.allNote'),
    },
    {
      value: 'mentions',
      label: t('room.settings.notifications.mentions'),
      icon: <AtIcon size={14} />,
      description: t('room.settings.notifications.mentionsNote'),
    },
    {
      value: 'mute',
      label: t('room.settings.notifications.mute'),
      icon: <BellSlashIcon size={14} />,
      description: t('room.settings.notifications.muteNote'),
    },
  ];

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.notifications.title')}</h2>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.notifications.level')}</h3>
        <p className={css.settingNote} style={{ marginBottom: '16px' }}>
          {t('room.settings.notifications.levelNote')}
        </p>

        {options.map((opt) => (
          <div
            key={opt.value}
            className={css.settingRow}
            style={{ cursor: saving ? 'not-allowed' : 'pointer' }}
            onClick={() => !saving && handleChange(opt.value)}
          >
            <div className={css.settingInfo}>
              <span
                className={css.settingLabel}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {opt.icon}
                {opt.label}
              </span>
              <span className={css.settingNote}>{opt.description}</span>
            </div>
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: `2px solid ${level === opt.value ? vars.color.accent : vars.color.border}`,
                backgroundColor: level === opt.value ? vars.color.accent : 'transparent',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s, border-color 0.15s',
              }}
            >
              {level === opt.value && (
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
