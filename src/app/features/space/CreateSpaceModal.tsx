import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { EventType, Preset, Visibility } from 'matrix-js-sdk';
import { DEFAULT_TREE_POWER_LEVELS_TEMPLATE } from 'matrix-js-sdk/lib/models/MSC3089TreeSpace';
import { PlusIcon, ArrowLineRightIcon, StackIcon } from '@phosphor-icons/react';
import { createSpaceOpenAtom } from '@/app/store/atoms';
import { getMatrixClient } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { viaServersFor, normalizeJoinTarget } from '@/util/matrix';
import type { UntypedStateEventType } from '@/types/matrix';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { ToggleRow } from '@/app/components/Toggle';
import * as css from './CreateSpaceModal.css';

type Tab = 'create' | 'join';

export function CreateSpaceModal() {
  const { t } = useTranslation();
  const [state, setState] = useAtom(createSpaceOpenAtom);
  const toast = useToast();

  const { open, parentSpaceId, parentSpaceName } = state;

  const [tab, setTab] = useState<Tab>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [federated, setFederated] = useState(true);
  const [spaceAlias, setSpaceAlias] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [spaceId, setSpaceId] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const resetAndClose = () => {
    setState({ open: false });
    setTab('create');
    setName('');
    setDescription('');
    setIsPublic(false);
    setFederated(true);
    setSpaceAlias('');
    setSpaceId('');
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t('room.space.create.nameRequired'));
      return;
    }

    setCreateLoading(true);
    try {
      const client = getMatrixClient();
      const { room_id: newRoomId } = await client.createRoom({
        name: trimmedName,
        topic: description.trim() || undefined,
        visibility: isPublic ? Visibility.Public : Visibility.Private,
        preset: isPublic ? Preset.PublicChat : Preset.PrivateChat,
        power_level_content_override: {
          ...DEFAULT_TREE_POWER_LEVELS_TEMPLATE,
          users: { [client.getUserId() ?? '']: 100 },
        },
        creation_content: { type: 'm.space', 'm.federate': federated },
      });

      const aliasToSet = spaceAlias.trim();
      if (isPublic && aliasToSet && newRoomId) {
        try {
          await client.createAlias(aliasToSet, newRoomId);
          await client.sendStateEvent(
            newRoomId,
            'm.room.canonical_alias' as UntypedStateEventType,
            { alias: aliasToSet },
            ''
          );
        } catch (aliasErr) {
          toast.error(
            t('room.space.create.aliasCreateFailed', { error: getErrorMessage(aliasErr) })
          );
        }
      }

      if (parentSpaceId && newRoomId) {
        const domain = client.getDomain() ?? '';
        await client.sendStateEvent(
          parentSpaceId,
          EventType.SpaceChild,
          { via: [domain] },
          newRoomId
        );
        await client.sendStateEvent(
          newRoomId,
          EventType.SpaceParent,
          { via: [domain], canonical: true },
          parentSpaceId
        );
      }

      resetAndClose();
    } catch (err) {
      toast.error(t('room.space.create.failed', { error: getErrorMessage(err) }));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = async () => {
    const trimmedInput = spaceId.trim();
    if (!trimmedInput) {
      toast.error(t('room.space.join.idRequired'));
      return;
    }

    const target = normalizeJoinTarget(trimmedInput);
    if (!target) {
      toast.error(t('room.space.join.idRequired'));
      return;
    }

    setJoinLoading(true);
    try {
      const client = getMatrixClient();
      const derived = viaServersFor(target.roomIdOrAlias, client.getDomain()).viaServers;
      const viaServers = target.viaServers.length > 0 ? target.viaServers : derived;
      await client.joinRoom(
        target.roomIdOrAlias,
        viaServers.length > 0 ? { viaServers } : undefined
      );
      resetAndClose();
    } catch (err) {
      toast.error(t('room.space.join.failed', { error: getErrorMessage(err) }));
    } finally {
      setJoinLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (tab === 'create') handleCreate();
      else handleJoin();
    }
  };

  const title = parentSpaceName
    ? t('room.space.create.titleInParent', { name: parentSpaceName })
    : t('room.space.create.title');

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      size="md"
      title={title}
      titleIcon={<StackIcon size={18} weight="fill" />}
      footer={
        tab === 'create' ? (
          <>
            <Button variant="secondary" onClick={resetAndClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={createLoading} onClick={handleCreate}>
              {t('room.space.create.create')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={resetAndClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={joinLoading} onClick={handleJoin}>
              {t('room.space.join.title')}
            </Button>
          </>
        )
      }
    >
      {!parentSpaceId && (
        <div className={css.tabs}>
          <button
            type="button"
            className={tab === 'create' ? css.tabActive : css.tab}
            onClick={() => setTab('create')}
          >
            <PlusIcon size={14} className={css.iconMargin} />
            {t('room.space.create.titleShort')}
          </button>
          <button
            type="button"
            className={tab === 'join' ? css.tabActive : css.tab}
            onClick={() => setTab('join')}
          >
            <ArrowLineRightIcon size={14} className={css.iconMargin} />
            {t('room.space.join.titleShort')}
          </button>
        </div>
      )}

      {tab === 'create' && (
        <div className={css.panel} onKeyDown={handleKeyDown}>
          <Input
            label={t('room.space.name')}
            placeholder={t('room.space.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-dialog-autofocus
            maxLength={255}
          />
          <Input
            label={`${t('room.topic')} (${t('common.optional')})`}
            placeholder={t('room.topicPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <ToggleRow
            label={t('room.space.create.public')}
            description={t('room.space.create.publicNote')}
            checked={isPublic}
            onChange={(v) => {
              setIsPublic(v);
              if (!v) setSpaceAlias('');
            }}
            size="sm"
          />
          {isPublic && (
            <Input
              label={t('room.space.create.roomAddress')}
              placeholder={t('room.space.create.roomAddressPlaceholder')}
              value={spaceAlias}
              onChange={(e) => setSpaceAlias(e.target.value)}
            />
          )}
          <ToggleRow
            label={t('room.create.federation')}
            description={t('room.create.federationNote')}
            checked={federated}
            onChange={setFederated}
            size="sm"
          />
        </div>
      )}

      {tab === 'join' && (
        <div className={css.panel} onKeyDown={handleKeyDown}>
          <Input
            label={t('room.space.join.spaceId')}
            placeholder={t('room.space.join.spaceIdPlaceholder')}
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            data-dialog-autofocus
          />
        </div>
      )}
    </Modal>
  );
}
