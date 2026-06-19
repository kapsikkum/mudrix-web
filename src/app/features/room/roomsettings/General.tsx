import React, { useState, useRef, useEffect } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CameraIcon,
  UsersIcon,
  LockIcon,
  CopyIcon,
  SignOutIcon,
  ArrowUpIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { confirmModalAtom } from '@/app/store/atoms';
import { EventType } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar, fetchMediaBlobUrl } from '@/app/components/Avatar';
import { Button, IconButton } from '@/app/components/Button';
import { Input, Textarea } from '@/app/components/Input';
import { MediaLightbox } from '@/app/components/MediaLightbox/MediaLightbox';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { getStateEventContent } from '@/util/matrix';
import type { UntypedStateEventType } from '@/types/matrix';
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

  // Alias data
  const aliasEvents = room?.currentState?.getStateEvents('m.room.aliases');
  const allAliases: string[] = [];
  if (aliasEvents) {
    const events = Array.isArray(aliasEvents) ? aliasEvents : [aliasEvents];
    const aliasSet = new Set<string>();
    for (const ev of events) {
      const content = ev.getContent();
      const list = content?.aliases as string[] | undefined;
      if (list) {
        for (const a of list) {
          aliasSet.add(a);
        }
      }
    }
    allAliases.push(...aliasSet);
  }
  const canonicalEvent = room?.currentState?.getStateEvents('m.room.canonical_alias', '');
  const canonicalAlias: string | null =
    (canonicalEvent?.getContent()?.alias as string | undefined) ?? null;
  const canSetCanonical = (room?.getMember(myUserId)?.powerLevel ?? 0) >= 50;

  const [name, setName] = useState(currentName);
  const [topic, setTopic] = useState(currentTopic);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const [newAlias, setNewAlias] = useState('');
  const [addingAlias, setAddingAlias] = useState(false);
  const navigate = useNavigate();

  const isDirty = name !== currentName || topic !== currentTopic || avatarFile !== null;

  useEffect(() => {
    setName(currentName);
    setTopic(currentTopic);
    setAvatarFile(null);
    setAvatarPreview(null);
  }, [roomId, currentName, currentTopic]);

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
      .then(() => toast.success(t('common.copied')))
      .catch(() => toast.error(t('common.copyFailed')));
  };

  const handleUpgrade = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      setConfirm({
        open: true,
        title: t('room.upgrade.title'),
        message: t('room.upgrade.confirm'),
        danger: true,
        resolve,
      });
    });
    if (!confirmed || !client || !room) return;
    setUpgrading(true);
    try {
      const { version: newVersion } = await room.getRecommendedVersion();
      const { replacement_room: newRoomId } = await client.upgradeRoom(roomId, newVersion);

      // Copy room metadata and settings to the new room
      const ops: Promise<unknown>[] = [];

      const evName = room.currentState.getStateEvents(EventType.RoomName, '');
      const nameEvent = Array.isArray(evName) ? evName[0] : evName;
      if (nameEvent)
        ops.push(client.sendStateEvent(newRoomId, EventType.RoomName, nameEvent.getContent(), ''));

      const evTopic = room.currentState.getStateEvents(EventType.RoomTopic, '');
      const topicEvent = Array.isArray(evTopic) ? evTopic[0] : evTopic;
      if (topicEvent)
        ops.push(
          client.sendStateEvent(newRoomId, EventType.RoomTopic, topicEvent.getContent(), '')
        );

      const evAvatar = room.currentState.getStateEvents(EventType.RoomAvatar, '');
      const avatarEvent = Array.isArray(evAvatar) ? evAvatar[0] : evAvatar;
      if (avatarEvent)
        ops.push(
          client.sendStateEvent(newRoomId, EventType.RoomAvatar, avatarEvent.getContent(), '')
        );

      const evJoinRules = room.currentState.getStateEvents(EventType.RoomJoinRules, '');
      const joinRulesEvent = Array.isArray(evJoinRules) ? evJoinRules[0] : evJoinRules;
      if (joinRulesEvent)
        ops.push(
          client.sendStateEvent(newRoomId, EventType.RoomJoinRules, joinRulesEvent.getContent(), '')
        );

      const evHistoryVis = room.currentState.getStateEvents(EventType.RoomHistoryVisibility, '');
      const historyVisEvent = Array.isArray(evHistoryVis) ? evHistoryVis[0] : evHistoryVis;
      if (historyVisEvent)
        ops.push(
          client.sendStateEvent(
            newRoomId,
            EventType.RoomHistoryVisibility,
            historyVisEvent.getContent(),
            ''
          )
        );

      const evPowerLevels = room.currentState.getStateEvents(EventType.RoomPowerLevels, '');
      const powerLevelsEvent = Array.isArray(evPowerLevels) ? evPowerLevels[0] : evPowerLevels;
      if (powerLevelsEvent)
        ops.push(
          client.sendStateEvent(
            newRoomId,
            EventType.RoomPowerLevels,
            powerLevelsEvent.getContent(),
            ''
          )
        );

      await Promise.all(ops);

      // Wait for the new room to be available after state events

      await Promise.all(ops);

      // Invite all joined members if the room is not public
      const joinRuleEv = room.currentState.getStateEvents('m.room.join_rules', '');
      const joinRule = (joinRuleEv?.getContent() as { join_rule?: string } | undefined)?.join_rule;
      if (joinRule !== 'public') {
        const myId = client.getUserId() ?? '';
        const members = room.getJoinedMembers().filter((m) => m.userId !== myId);
        await Promise.allSettled(members.map((m) => client.invite(newRoomId, m.userId)));
      }

      // Find all spaces that contain the old room and add the new room to them
      const spaceParents = client
        .getRooms()
        .filter(
          (sp) =>
            sp.isSpaceRoom() &&
            sp.getMyMembership() === 'join' &&
            sp.currentState.getStateEvents('m.space.child', roomId)
        );
      await Promise.allSettled(
        spaceParents.map((sp) => {
          const content = sp.currentState
            .getStateEvents('m.space.child', roomId)!
            .getContent() as Record<string, unknown>;
          return client.sendStateEvent(sp.roomId, EventType.SpaceChild, content, newRoomId);
        })
      );

      onClose();
      const newRoom = client.getRoom(newRoomId);
      const newRoomName = newRoom?.name ?? newRoomId;
      toast.success(t('room.upgrade.success', { name: newRoomName }));
      navigate(`/r/${encodeURIComponent(newRoomId)}`);
    } catch (err) {
      toast.error(t('room.upgrade.failed', { error: getErrorMessage(err) }));
    } finally {
      setUpgrading(false);
    }
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

  function isValidAlias(value: string): boolean {
    return /^#[A-Za-z0-9.\-_/=]+:[A-Za-z0-9.\-_]+$/.test(value);
  }

  const handleAddAlias = async () => {
    const trimmed = newAlias.trim();
    if (!trimmed) return;
    if (!isValidAlias(trimmed)) {
      toast.error(t('room.settings.addresses.invalidFormat'));
      return;
    }
    if (!client) return;
    setAddingAlias(true);
    try {
      await client.createAlias(trimmed, roomId);
      toast.success(t('room.settings.addresses.added'));
      setNewAlias('');
    } catch (err) {
      toast.error(
        getErrorMessage(err).includes('already in use')
          ? t('room.settings.addresses.aliasInUse')
          : t('room.settings.addresses.invalidFormat')
      );
    } finally {
      setAddingAlias(false);
    }
  };

  const handleRemoveAlias = async (alias: string) => {
    if (!client) return;
    try {
      await client.deleteAlias(alias);
      toast.success(t('room.settings.addresses.removed'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSetCanonical = async (alias: string) => {
    if (!client) return;
    try {
      await client.sendStateEvent(
        roomId,
        'm.room.canonical_alias' as UntypedStateEventType,
        { alias },
        ''
      );
      toast.success(t('room.settings.addresses.mainUpdated'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.general.title')}</h2>

      {!isAdmin && (
        <div className={css.readOnlyNote}>
          <LockIcon size={14} />
          {t('room.settings.readOnlyPermissions')}
        </div>
      )}

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('common.avatar')}</h3>
        <div className={css.avatarRow}>
          <div className={css.avatarUploadWrap}>
            <div
              className={css.avatarClickable}
              onClick={async () => {
                if (currentAvatarMxc || avatarPreview) {
                  if (avatarPreview) {
                    setLightboxSrc(avatarPreview);
                  } else if (currentAvatarMxc && client) {
                    const blob = await fetchMediaBlobUrl(currentAvatarMxc, client);
                    if (blob) setLightboxSrc(blob);
                  }
                  return;
                }
                if (isAdmin) fileRef.current?.click();
              }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="preview" className={css.avatarPreviewImg} />
              ) : (
                <Avatar
                  name={room?.name ?? ''}
                  mxcUrl={currentAvatarMxc}
                  client={client ?? undefined}
                  size="xl"
                />
              )}
              {isAdmin && !currentAvatarMxc && !avatarPreview && (
                <div className={css.avatarOverlay}>
                  <CameraIcon size={20} className={css.whiteIcon} />
                </div>
              )}
            </div>
            {lightboxSrc && (
              <MediaLightbox
                src={lightboxSrc}
                name={room?.name ?? ''}
                client={client ?? undefined}
                avatarMxc={currentAvatarMxc}
                onClose={() => setLightboxSrc(null)}
                onReplace={
                  isAdmin
                    ? () => {
                        setLightboxSrc(null);
                        setTimeout(() => fileRef.current?.click(), 100);
                      }
                    : undefined
                }
                onRemove={
                  isAdmin
                    ? () => {
                        setLightboxSrc(null);
                        handleRemoveAvatar();
                      }
                    : undefined
                }
              />
            )}
          </div>
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
          <IconButton size="sm" onClick={handleCopyId} aria-label={t('common.copy')}>
            <CopyIcon size={14} />
          </IconButton>
        </div>
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.addresses.title')}</h3>

        {canonicalAlias ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: 'var(--color-bg-secondary)',
              marginBottom: 6,
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                color: 'var(--color-text-primary)',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {canonicalAlias}
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 10,
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {t('room.settings.general.title')}
            </span>
          </div>
        ) : (
          <p className={css.settingNote}>{t('room.settings.addresses.noAddresses')}</p>
        )}

        {allAliases.map((alias) => (
          <div
            key={alias}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: 'var(--color-bg-secondary)',
              marginBottom: 6,
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                color: 'var(--color-text-primary)',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {alias}
            </span>
            {canSetCanonical && alias !== canonicalAlias && (
              <Button variant="secondary" size="sm" onClick={() => handleSetCanonical(alias)}>
                {t('room.settings.addresses.mainAddress')}
              </Button>
            )}
            <IconButton
              size="sm"
              onClick={() => handleRemoveAlias(alias)}
              aria-label={t('room.settings.addresses.removeAddress')}
            >
              <TrashIcon size={14} />
            </IconButton>
          </div>
        ))}

        {canSetCanonical && (
          <div className={css.flexRowWrap} style={{ marginTop: 16 }}>
            <div className={css.flexOne}>
              <Input
                placeholder={t('room.settings.addresses.addressPlaceholder')}
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
              />
            </div>
            <Button
              variant="primary"
              loading={addingAlias}
              onClick={handleAddAlias}
              disabled={!newAlias.trim()}
            >
              {t('room.settings.addresses.addAddress')}
            </Button>
          </div>
        )}
      </div>

      <div className={css.divider} />

      {isAdmin && room && (
        <div className={css.section}>
          <h3 className={css.sectionTitle}>{t('room.upgrade.title')}</h3>
          <p className={css.settingNote}>
            {t('room.upgrade.currentVersion', { version: room.getVersion() })}
          </p>
          <Button
            variant="secondary"
            loading={upgrading}
            onClick={handleUpgrade}
            disabled={saving || leaving}
          >
            <ArrowUpIcon size={14} className={css.iconBefore} />
            {t('room.upgrade.title')}
          </Button>
        </div>
      )}

      <div className={css.divider} />

      <div className={css.section}>
        <Button
          variant="danger"
          loading={leaving}
          onClick={handleLeave}
          disabled={saving || upgrading}
        >
          <SignOutIcon size={14} className={css.iconBefore} />
          {t('room.leaveRoom')}
        </Button>
      </div>
    </div>
  );
}
