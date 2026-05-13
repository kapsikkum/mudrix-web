import React, { useState, useRef, useEffect } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  EyeIcon,
  CameraIcon,
  UsersIcon,
  LockIcon,
  CopyIcon,
  SignOutIcon,
} from '@phosphor-icons/react';
import { confirmModalAtom } from '@/app/store/atoms';
import { EventType } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar, clearAvatarCache } from '@/app/components/Avatar';
import { Button, IconButton } from '@/app/components/Button';
import { Input, Textarea } from '@/app/components/Input';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { getStateEventContent } from '@/util/matrix';
import * as css from '@/app/components/Settings/Settings.css';

interface GeneralPanelProps {
  roomId: string;
  roomName: string;
  onClose: () => void;
}

export function GeneralPanel({ roomId, roomName, onClose }: GeneralPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const [, setConfirm] = useAtom(confirmModalAtom);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const room = client?.getRoom(roomId) ?? null;

  const nameContent = getStateEventContent(room, 'm.room.name');
  const topicContent = getStateEventContent(room, 'm.room.topic');

  const currentName: string = (nameContent?.name as string | undefined) ?? room?.name ?? '';
  const currentTopic: string = (topicContent?.topic as string | undefined) ?? '';
  const currentAvatarMxc: string | null = room?.getMxcAvatarUrl?.() ?? null;

  const myUserId = client?.getUserId() ?? '';
  const isAdmin = (room?.getMember(myUserId)?.powerLevel ?? 0) >= 100;
  const isEncrypted = !!room?.currentState?.getStateEvents('m.room.encryption', '');
  const memberCount = room?.getJoinedMemberCount() ?? 0;

  const [name, setName] = useState(currentName);
  const [topic, setTopic] = useState(currentTopic);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const isDirty = name !== currentName || topic !== currentTopic || avatarFile !== null;

  useEffect(() => {
    setName(currentName);
    setTopic(currentTopic);
    setAvatarFile(null);
    setAvatarPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleRemoveAvatar = () => {
    setConfirm({
      open: true,
      title: t('common.removeAvatar'),
      message: t('common.removeAvatarConfirm'),
      danger: true,
      resolve: async (confirmed) => {
        if (!confirmed || !client) return;
        try {
          if (currentAvatarMxc) clearAvatarCache(currentAvatarMxc);
          await client.sendStateEvent(roomId, EventType.RoomAvatar, { url: '' }, '');
          setAvatarFile(null);
          setAvatarPreview(null);
          toast.success(t('common.avatarRemoved'));
        } catch (err) {
          toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
        }
      },
    });
  };

  const handleCopyId = () => {
    navigator.clipboard
      .writeText(roomId)
      .then(() => toast.success(t('room.settings.general.idCopied')));
  };

  const handleLeave = () => {
    setConfirm({
      open: true,
      title: t('room.leaveRoom'),
      message: t('room.leaveRoomConfirm', { name: roomName }),
      danger: true,
      resolve: async (confirmed) => {
        if (!confirmed || !client) return;
        setLeaving(true);
        try {
          await client.leave(roomId);
          await client.forget(roomId);
          toast.success(t('room.leaveSuccess', { name: roomName }));
          onClose();
        } catch (err) {
          toast.error(t('room.leaveFailed', { error: getErrorMessage(err) }));
        } finally {
          setLeaving(false);
        }
      },
    });
  };

  const handleSave = async () => {
    if (!client || !room) return;
    setSaving(true);
    try {
      const ops: Promise<unknown>[] = [];
      if (avatarFile) {
        const { content_uri: mxcUrl } = await client.uploadContent(avatarFile, {
          name: avatarFile.name,
        });
        if (currentAvatarMxc) clearAvatarCache(currentAvatarMxc);
        ops.push(client.sendStateEvent(roomId, EventType.RoomAvatar, { url: mxcUrl }, ''));
      }
      if (name.trim() !== currentName)
        ops.push(client.sendStateEvent(roomId, EventType.RoomName, { name: name.trim() }, ''));
      if (topic !== currentTopic)
        ops.push(client.sendStateEvent(roomId, EventType.RoomTopic, { topic }, ''));
      await Promise.all(ops);
      toast.success(t('common.saved'));
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.general.title')}</h2>

      {!isAdmin && (
        <div className={css.readOnlyNote}>
          <EyeIcon size={14} />
          {t('room.settings.readOnlyRoom')}
        </div>
      )}

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('common.avatar')}</h3>
        <div className={css.avatarRow}>
          {isAdmin ? (
            <div className={css.avatarUploadWrap}>
              <div className={css.avatarClickable} onClick={() => fileRef.current?.click()}>
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="preview"
                    className={css.avatarPreviewImg}
                  />
                ) : (
                  <Avatar
                    name={room?.name ?? ''}
                    mxcUrl={currentAvatarMxc}
                    client={client ?? undefined}
                    size="xl"
                  />
                )}
                <div className={css.avatarOverlay}>
                  <CameraIcon size={20} className={css.whiteIcon} />
                </div>
              </div>
              {(avatarPreview || currentAvatarMxc) && (
                <button onClick={handleRemoveAvatar} className={css.removeAvatarBtn}>
                  {t('common.removeAvatar')}
                </button>
              )}
            </div>
          ) : (
            <div className={css.avatarReadOnly}>
              <Avatar
                name={room?.name ?? ''}
                mxcUrl={currentAvatarMxc}
                client={client ?? undefined}
                size="xl"
              />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className={css.hiddenInput}
            onChange={handleAvatarSelect}
          />
          <div>
            <div className={css.badgeRow}>
              <span className={css.badge}>
                <UsersIcon size={12} /> {memberCount}{' '}
                {memberCount !== 1
                  ? t('room.settings.membersCount_other', { count: memberCount })
                      .split(' ')
                      .slice(1)
                      .join(' ')
                  : t('room.settings.membersCount_one', { count: memberCount })
                      .split(' ')
                      .slice(1)
                      .join(' ')}
              </span>
              {isEncrypted && (
                <span className={css.badge}>
                  <LockIcon size={12} /> {t('room.settings.general.encrypted')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.general.identity')}</h3>
        <div className={css.fieldGroup}>
          <Input
            label={t('room.name')}
            placeholder={t('room.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
            maxLength={255}
          />
          <Textarea
            label={t('room.topic')}
            placeholder={t('room.topicPlaceholder')}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={!isAdmin}
            rows={3}
          />
        </div>
      </div>

      {isAdmin && (
        <div className={css.actions}>
          <Button variant="secondary" onClick={onClose} disabled={saving || leaving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={saving}
            onClick={handleSave}
            disabled={!isDirty || leaving}
          >
            {t('common.save')}
          </Button>
        </div>
      )}

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.general.id')}</h3>
        <div className={css.tokenRow}>
          <code className={css.tokenField}>{roomId}</code>
          <IconButton size="sm" onClick={handleCopyId} title={t('room.settings.general.idCopy')}>
            <CopyIcon size={14} />
          </IconButton>
        </div>
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <Button variant="danger" loading={leaving} onClick={handleLeave} disabled={saving}>
          <SignOutIcon size={14} className={css.iconBefore} />
          {t('room.leaveRoom')}
        </Button>
      </div>
    </div>
  );
}
