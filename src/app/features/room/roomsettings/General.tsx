import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowUpIcon, LockSimpleIcon, LockSimpleOpenIcon } from '@phosphor-icons/react';
import { developerModeAtom } from '@/app/store/atoms';
import { useConfirm } from '@/app/hooks/useConfirm';
import { EventType, HistoryVisibility } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Button, CopyButton } from '@/app/components/Button';
import { Select } from '@/app/components/Select';
import { useToast } from '@/app/hooks/useToast';
import { useCanSendState } from '@/app/hooks/useCanSendState';
import { getErrorMessage } from '@/util/error';
import {
  getStateEventContent,
  roomStateMaybe,
  isSpace,
  joinRuleToAccess,
  isActiveSpaceChild,
} from '@/util/matrix';
import { Toggle } from '@/app/components/Toggle';
import type { UntypedStateEventType } from '@/types/matrix';
import * as css from '@/app/components/Settings/Settings.css';
import { RoomSpacesSection } from './RoomSpaces';
import { useIdentityForm, type AccessOption } from './useIdentityForm';
import { IdentitySection } from './IdentitySection';
import { AddressesSection } from './AddressesSection';
import { SoundboardRoomSettings } from '@/app/features/soundboard/SoundboardRoomSettings';
import { Sensitive } from '@/app/components/Sensitive';

const ROOM_ENC_ALGO = 'm.megolm.v1.aes-sha2';

interface GeneralPanelProps {
  roomId: string;
  onClose: () => void;
}

export function GeneralPanel({ roomId, onClose }: GeneralPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const confirmDialog = useConfirm();
  const [devModeEnabled] = useAtom(developerModeAtom);
  const toast = useToast();

  const room = client?.getRoom(roomId) ?? null;

  const encryptionContent = getStateEventContent(room, EventType.RoomEncryption);
  const historyContent = getStateEventContent(room, EventType.RoomHistoryVisibility);

  const isEncrypted: boolean = Boolean(encryptionContent.algorithm);
  const currentHistory: HistoryVisibility =
    (historyContent?.history_visibility as HistoryVisibility) ?? HistoryVisibility.Joined;

  const can = useCanSendState(room);
  const canSetName = can(EventType.RoomName);
  const canSetTopic = can(EventType.RoomTopic);
  const canSetAvatar = can(EventType.RoomAvatar);
  const canEnableEncryption = can(EventType.RoomEncryption);
  const canSetJoinRules = can(EventType.RoomJoinRules);
  const canSetHistory = can(EventType.RoomHistoryVisibility);

  const spaceId =
    client?.getRooms().find(
      (r) =>
        r.isSpaceRoom() &&
        roomStateMaybe(r)
          ?.getStateEvents('m.space.child')
          .filter(isActiveSpaceChild)
          .some((e) => e.getStateKey() === roomId)
    )?.roomId ?? null;

  const historyOptions: { value: HistoryVisibility; label: string }[] = [
    { value: HistoryVisibility.WorldReadable, label: t('room.settings.security.historyAnyone') },
    { value: HistoryVisibility.Shared, label: t('room.settings.security.historyShared') },
    { value: HistoryVisibility.Invited, label: t('room.settings.security.historyInvited') },
    { value: HistoryVisibility.Joined, label: t('room.settings.security.historyMembersSinceJoin') },
  ];

  // Alias data
  const canonicalEvent = roomStateMaybe(room)?.getStateEvents('m.room.canonical_alias', '');
  const canonicalEventContent = canonicalEvent?.getContent() ?? {};
  const canonicalAlias: string | null = (canonicalEventContent.alias as string | undefined) ?? null;
  const altAliases: string[] = (canonicalEventContent.alt_aliases as string[] | undefined) ?? [];
  const allAliases: string[] = [...new Set(altAliases.filter((a) => a !== canonicalAlias))];
  const canSetCanonical = can('m.room.canonical_alias');

  const [history, setHistory] = useState<HistoryVisibility>(currentHistory);
  const [historySaving, setHistorySaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [enablingEncryption, setEnablingEncryption] = useState(false);
  const navigate = useNavigate();

  const form = useIdentityForm({
    client,
    room,
    roomId,
    restrictedAllowRoomId: spaceId,
    resetKey: currentHistory,
    onReset: () => setHistory(currentHistory),
  });
  const { access, setAccess, saving } = form;

  const handleUpgrade = async () => {
    const confirmed = await confirmDialog({
      title: t('room.upgrade.title'),
      message: t('room.upgrade.confirm'),
      danger: true,
    });
    if (!confirmed || !client || !room) return;
    setUpgrading(true);
    try {
      // Find parent spaces before upgrade
      const parentSpaces = client.getRooms().filter(
        (r) =>
          isSpace(r) &&
          roomStateMaybe(r)
            ?.getStateEvents(EventType.SpaceChild)
            .filter(isActiveSpaceChild)
            ?.some((e) => e.getStateKey() === roomId)
      );
      const domain = client.getDomain() ?? '';

      const { version: newVersion } = await room.getRecommendedVersion();
      const { replacement_room: newRoomId } = await client.upgradeRoom(roomId, newVersion);

      const joinRuleContent = getStateEventContent(room, EventType.RoomJoinRules);
      const joinRule = (joinRuleContent as { join_rule?: string }).join_rule;
      if (joinRule !== 'public') {
        const members = room.getJoinedMembers();
        const myUserId = client.getUserId();
        await Promise.allSettled(
          members
            .filter((m) => m.userId !== myUserId)
            .map((m) => client.invite(newRoomId, m.userId))
        );
      }

      // Re-attach new room to parent spaces
      await Promise.allSettled(
        parentSpaces.map((space) =>
          Promise.all([
            client.sendStateEvent(space.roomId, EventType.SpaceChild, { via: [domain] }, newRoomId),
            client.sendStateEvent(
              newRoomId,
              EventType.SpaceParent,
              { via: [domain], canonical: true },
              space.roomId
            ),
          ])
        )
      );

      onClose();
      navigate(`/r/${encodeURIComponent(newRoomId)}`);
    } catch (err) {
      toast.error(t('room.upgrade.failed', { error: getErrorMessage(err) }));
    } finally {
      setUpgrading(false);
    }
  };

  const handleEnableEncryption = async () => {
    if (!client || !room || isEncrypted || !canEnableEncryption) return;

    let message = t('room.settings.general.encryptionConfirm');
    if (
      joinRuleToAccess(getStateEventContent(room, EventType.RoomJoinRules).join_rule as string) ===
      'public'
    ) {
      message = `${t('room.settings.general.encryptionPublicRoomWarning')}\n\n${message}`;
    }

    const ok = await confirmDialog({
      title: t('room.settings.general.e2ee'),
      message,
      danger: true,
    });
    if (!ok) return;

    setEnablingEncryption(true);
    try {
      await client.sendStateEvent(
        roomId,
        EventType.RoomEncryption,
        { algorithm: ROOM_ENC_ALGO },
        ''
      );
    } catch (err) {
      toast.error(
        t('room.settings.general.encryptionEnableFailed', { error: getErrorMessage(err) })
      );
    } finally {
      setEnablingEncryption(false);
    }
  };

  const handleHistoryChange = async (value: HistoryVisibility) => {
    if (!client || !room || value === currentHistory || historySaving) return;
    setHistory(value);
    setHistorySaving(true);
    try {
      await client.sendStateEvent(
        roomId,
        EventType.RoomHistoryVisibility,
        { history_visibility: value },
        ''
      );
    } catch (err) {
      setHistory(currentHistory);
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    } finally {
      setHistorySaving(false);
    }
  };

  const handleAddAlias = async (c: MatrixClient, alias: string) => {
    await c.createAlias(alias, roomId);
    const currentContent =
      roomStateMaybe(room)?.getStateEvents('m.room.canonical_alias', '')?.getContent() ?? {};
    const currentAlt: string[] = (currentContent.alt_aliases as string[] | undefined) ?? [];
    if (!currentAlt.includes(alias)) {
      await c.sendStateEvent(
        roomId,
        'm.room.canonical_alias' as UntypedStateEventType,
        { ...currentContent, alt_aliases: [...currentAlt, alias] },
        ''
      );
    }
  };

  const handleRemoveAlias = async (c: MatrixClient, alias: string) => {
    await c.deleteAlias(alias);
    const currentContent =
      roomStateMaybe(room)?.getStateEvents('m.room.canonical_alias', '')?.getContent() ?? {};
    const currentAlt: string[] = (currentContent.alt_aliases as string[] | undefined) ?? [];
    const currentCanonical: string | undefined = currentContent.alias as string | undefined;
    await c.sendStateEvent(
      roomId,
      'm.room.canonical_alias' as UntypedStateEventType,
      {
        ...currentContent,
        alias: currentCanonical === alias ? '' : currentCanonical,
        alt_aliases: currentAlt.filter((a) => a !== alias),
      },
      ''
    );
  };

  const handleSetCanonical = async (c: MatrixClient, alias: string) => {
    const currentContent =
      roomStateMaybe(room)?.getStateEvents('m.room.canonical_alias', '')?.getContent() ?? {};
    const currentCanonical: string | undefined = currentContent.alias as string | undefined;
    const currentAlt: string[] = (currentContent.alt_aliases as string[] | undefined) ?? [];
    const newAlt = [
      ...new Set([
        ...(currentCanonical && currentCanonical !== alias ? [currentCanonical] : []),
        ...currentAlt.filter((a) => a !== alias),
      ]),
    ];
    await c.sendStateEvent(
      roomId,
      'm.room.canonical_alias' as UntypedStateEventType,
      { ...currentContent, alias, alt_aliases: newAlt },
      ''
    );
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.general.title')}</h2>

      <IdentitySection
        form={form}
        client={client}
        roomName={room?.name ?? ''}
        nameLabel={t('room.name')}
        namePlaceholder={t('room.namePlaceholder')}
        canSetName={canSetName}
        canSetTopic={canSetTopic}
        canSetAvatar={canSetAvatar}
        canSetJoinRules={canSetJoinRules}
      />

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.security.title')}</h3>

        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('room.settings.security.access')}</span>
          </div>
          <Select
            aria-label={t('room.settings.security.access')}
            value={access}
            disabled={!canSetJoinRules}
            options={[
              { value: 'invite', label: t('room.settings.security.accessInvite') },
              ...(spaceId
                ? [{ value: 'restricted', label: t('room.settings.security.accessSpaceMembers') }]
                : []),
              { value: 'knock', label: t('room.settings.security.accessKnock') },
              { value: 'public', label: t('room.settings.security.accessPublic') },
            ]}
            onChange={(v) => setAccess(v as AccessOption)}
          />
        </div>

        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('room.settings.security.messageHistory')}</span>
            <span className={css.settingNote}>{t('room.settings.security.historyNote')}</span>
          </div>
          <Select
            aria-label={t('room.settings.security.messageHistory')}
            value={history}
            disabled={!canSetHistory || historySaving}
            options={historyOptions}
            onChange={(v) => handleHistoryChange(v as HistoryVisibility)}
          />
        </div>

        {room && !isSpace(room) && (
          <div className={css.settingRow}>
            <div className={css.settingInfo}>
              <span className={css.settingLabel}>
                {isEncrypted ? (
                  <LockSimpleIcon
                    size={14}
                    weight="fill"
                    style={{ marginRight: 6, verticalAlign: '-2px' }}
                  />
                ) : (
                  <LockSimpleOpenIcon size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
                )}
                {t('room.settings.general.e2ee')}
              </span>
              <span className={css.settingNote}>
                {isEncrypted
                  ? t('room.settings.general.encryptionEnabledNote')
                  : t('room.settings.general.encryptionNote')}
              </span>
            </div>
            <Toggle
              checked={isEncrypted}
              disabled={isEncrypted || !canEnableEncryption || enablingEncryption}
              onChange={(checked) => {
                if (checked) handleEnableEncryption();
              }}
              ariaLabel={t('room.settings.general.e2ee')}
            />
          </div>
        )}
      </div>

      <div className={css.divider} />

      <SoundboardRoomSettings roomId={roomId} />

      {devModeEnabled && (
        <>
          <div className={css.divider} />

          <div className={css.section}>
            <h3 className={css.sectionTitle}>{t('room.settings.general.id')}</h3>
            <div className={css.tokenRow}>
              <code className={css.tokenField}>
                <Sensitive>{roomId}</Sensitive>
              </code>
              <CopyButton text={roomId} />
            </div>
          </div>
        </>
      )}

      <div className={css.divider} />

      <RoomSpacesSection roomId={roomId} />

      <div className={css.divider} />

      <AddressesSection
        client={client}
        canonicalAlias={canonicalAlias}
        aliases={allAliases}
        canEdit={canSetCanonical}
        onAdd={handleAddAlias}
        onRemove={handleRemoveAlias}
        onSetCanonical={handleSetCanonical}
      />

      {can(EventType.RoomTombstone) && room && (
        <>
          <div className={css.divider} />

          <div className={css.section}>
            <h3 className={css.sectionTitle}>{t('room.upgrade.title')}</h3>
            <p className={css.settingNote}>
              {t('room.upgrade.currentVersion', { version: room.getVersion() })}
            </p>
            <Button
              variant="secondary"
              loading={upgrading}
              onClick={handleUpgrade}
              disabled={saving}
            >
              <ArrowUpIcon size={14} className={css.iconBefore} />
              {t('room.upgrade.title')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
