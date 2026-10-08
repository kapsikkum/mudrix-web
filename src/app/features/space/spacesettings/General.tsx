import React, { useState, useRef, useEffect } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { CameraIcon, UsersIcon, SignOutIcon, TrashIcon } from '@phosphor-icons/react';
import { developerModeAtom } from '@/app/store/atoms';
import { useConfirm } from '@/app/hooks/useConfirm';
import { EventType } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar, fetchMediaBlobUrl } from '@/app/components/Avatar';
import { Button, CopyButton, IconButton } from '@/app/components/Button';
import { Input, Textarea } from '@/app/components/Input';
import { MediaLightbox } from '@/app/components/MediaLightbox/MediaLightbox';
import { useToast } from '@/app/hooks/useToast';
import { useCanSendState } from '@/app/hooks/useCanSendState';
import { getErrorMessage } from '@/util/error';
import { getStateEventContent, roomStateMaybe } from '@/util/matrix';
import type { UntypedStateEventType } from '@/types/matrix';
import * as css from '@/app/components/Settings/Settings.css';
import { vars } from '@/theme/vars.css';

interface GeneralPanelProps {
  spaceId: string;
  spaceName: string;
  onClose: () => void;
}

export function GeneralPanel({ spaceId, spaceName, onClose }: GeneralPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const confirmDialog = useConfirm();
  const [devModeEnabled] = useAtom(developerModeAtom);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const space = client?.getRoom(spaceId) ?? null;

  const nameContent = getStateEventContent(space, 'm.room.name');
  const topicContent = getStateEventContent(space, 'm.room.topic');
  const currentName: string = (nameContent?.name as string | undefined) ?? space?.name ?? '';
  const currentTopic: string = (topicContent?.topic as string | undefined) ?? '';
  const currentAvatarMxc: string | null = space?.getMxcAvatarUrl?.() ?? null;

  const can = useCanSendState(space);
  const canSetName = can(EventType.RoomName);
  const canSetTopic = can(EventType.RoomTopic);
  const canSetAvatar = can(EventType.RoomAvatar);
  const canEditIdentity = canSetName || canSetTopic || canSetAvatar;
  const memberCount = space?.getJoinedMemberCount() ?? 0;

  // Alias data
  const aliasEvents = roomStateMaybe(space)?.getStateEvents('m.room.aliases');
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
  const canonicalEvent = roomStateMaybe(space)?.getStateEvents('m.room.canonical_alias', '');
  const canonicalAlias: string | null =
    (canonicalEvent?.getContent()?.alias as string | undefined) ?? null;
  const canSetCanonical = can('m.room.canonical_alias');

  const [name, setName] = useState(currentName);
  const [topic, setTopic] = useState(currentTopic);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [newAlias, setNewAlias] = useState('');
  const [addingAlias, setAddingAlias] = useState(false);

  const isDirty = name !== currentName || topic !== currentTopic || avatarFile !== null;

  useEffect(() => {
    setName(currentName);
    setTopic(currentTopic);
    setAvatarFile(null);
    setAvatarPreview(null);
  }, [spaceId, currentName, currentTopic]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleRemoveAvatar = async () => {
    const ok = await confirmDialog({
      title: t('common.removeAvatar'),
      message: t('common.removeAvatarConfirm'),
      danger: true,
    });
    if (!ok || !client) return;
    try {
      await client.sendStateEvent(spaceId, EventType.RoomAvatar, { url: '' }, '');
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    }
  };

  const handleLeave = async () => {
    const ok = await confirmDialog({
      title: t('room.space.leave'),
      message: t('room.space.leaveConfirm', { name: spaceName }),
      danger: true,
    });
    if (!ok || !client) return;
    setLeaving(true);
    try {
      await client.leave(spaceId);
      await client.forget(spaceId);
      onClose();
    } catch (err) {
      toast.error(t('room.leaveFailed', { error: getErrorMessage(err) }));
    } finally {
      setLeaving(false);
    }
  };

  const handleSave = async () => {
    if (!client || !space) return;
    setSaving(true);
    try {
      const ops: Promise<unknown>[] = [];
      if (avatarFile) {
        const { content_uri: mxcUrl } = await client.uploadContent(avatarFile, {
          name: avatarFile.name,
        });
        ops.push(client.sendStateEvent(spaceId, EventType.RoomAvatar, { url: mxcUrl }, ''));
      }
      if (name.trim() !== currentName)
        ops.push(client.sendStateEvent(spaceId, EventType.RoomName, { name: name.trim() }, ''));
      if (topic !== currentTopic)
        ops.push(client.sendStateEvent(spaceId, EventType.RoomTopic, { topic }, ''));
      await Promise.all(ops);
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

  const canAddAlias = canSetCanonical && isValidAlias(newAlias.trim());

  const handleAddAlias = async () => {
    const trimmed = newAlias.trim();
    if (!isValidAlias(trimmed)) return;
    if (!client) return;
    setAddingAlias(true);
    try {
      await client.createAlias(trimmed, spaceId);
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
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSetCanonical = async (alias: string) => {
    if (!client) return;
    try {
      await client.sendStateEvent(
        spaceId,
        'm.room.canonical_alias' as UntypedStateEventType,
        { alias },
        ''
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.general.title')}</h2>

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
                if (canSetAvatar) fileRef.current?.click();
              }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="preview" className={css.avatarPreviewImg} />
              ) : (
                <Avatar
                  name={space?.name ?? ''}
                  mxcUrl={currentAvatarMxc}
                  client={client ?? undefined}
                  size="xl"
                />
              )}
              {canSetAvatar && !currentAvatarMxc && !avatarPreview && (
                <div className={css.avatarOverlay}>
                  <CameraIcon size={20} className={css.whiteIcon} />
                </div>
              )}
            </div>
            {lightboxSrc && (
              <MediaLightbox
                src={lightboxSrc}
                name={space?.name ?? ''}
                client={client ?? undefined}
                avatarMxc={currentAvatarMxc}
                onClose={() => setLightboxSrc(null)}
                onReplace={
                  canSetAvatar
                    ? () => {
                        setLightboxSrc(null);
                        setTimeout(() => fileRef.current?.click(), 100);
                      }
                    : undefined
                }
                onRemove={
                  canSetAvatar
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
                <UsersIcon size={12} /> {t('room.settings.membersCount', { count: memberCount })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.general.identity')}</h3>
        <div className={css.fieldGroup}>
          <Input
            label={t('room.space.name')}
            placeholder={t('room.space.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canSetName}
            maxLength={255}
          />
          <Textarea
            label={t('room.topic')}
            placeholder={t('room.topicPlaceholder')}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={!canSetTopic}
            rows={3}
          />
        </div>
      </div>

      {canEditIdentity && (
        <div className={css.actions}>
          <Button variant="secondary" onClick={onClose} disabled={saving || leaving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={saving}
            spinnerWhileLoading
            onClick={handleSave}
            disabled={!isDirty || leaving}
          >
            {t('common.save')}
          </Button>
        </div>
      )}

      {devModeEnabled && (
        <>
          <div className={css.divider} />

          <div className={css.section}>
            <h3 className={css.sectionTitle}>{t('room.space.settings.general.spaceId')}</h3>
            <div className={css.tokenRow}>
              <code className={css.tokenField}>{spaceId}</code>
              <CopyButton text={spaceId} />
            </div>
          </div>
        </>
      )}

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
              backgroundColor: vars.color.bgSecondary,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                color: vars.color.textPrimary,
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
                backgroundColor: vars.color.accent,
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
              backgroundColor: vars.color.bgSecondary,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                color: vars.color.textPrimary,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {alias}
            </span>
            {alias !== canonicalAlias && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSetCanonical(alias)}
                disabled={!canSetCanonical}
              >
                {t('room.settings.addresses.mainAddress')}
              </Button>
            )}
            <IconButton
              size="sm"
              onClick={() => handleRemoveAlias(alias)}
              aria-label={t('room.settings.addresses.removeAddress')}
              disabled={!canSetCanonical}
            >
              <TrashIcon size={14} />
            </IconButton>
          </div>
        ))}

        <div className={css.flexRowWrap} style={{ marginTop: 16 }}>
          <div className={css.flexOne}>
            <Input
              placeholder={t('room.settings.addresses.addressPlaceholder')}
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              disabled={!canSetCanonical}
            />
          </div>
          <Button
            variant="primary"
            loading={addingAlias}
            onClick={handleAddAlias}
            disabled={!canAddAlias}
          >
            {t('room.settings.addresses.addAddress')}
          </Button>
        </div>
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <Button variant="danger" loading={leaving} onClick={handleLeave} disabled={saving}>
          <SignOutIcon size={14} className={css.iconBefore} />
          {t('room.space.leave')}
        </Button>
      </div>
    </div>
  );
}
