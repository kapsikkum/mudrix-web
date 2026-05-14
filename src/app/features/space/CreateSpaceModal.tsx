import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Preset, Visibility } from 'matrix-js-sdk';
import { PlusIcon, ArrowLineRightIcon } from '@phosphor-icons/react';
import { createSpaceOpenAtom } from '@/app/store/atoms';
import { getMatrixClient } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { ToggleRow } from '@/app/components/Toggle';
import * as css from './CreateSpaceModal.css';

type Tab = 'create' | 'join';

export function CreateSpaceModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(createSpaceOpenAtom);
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('create');

  // Create tab state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Join tab state
  const [spaceId, setSpaceId] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const resetAndClose = () => {
    setOpen(false);
    setTab('create');
    setName('');
    setDescription('');
    setIsPublic(false);
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
      await client.createRoom({
        name: trimmedName,
        topic: description.trim() || undefined,
        visibility: isPublic ? Visibility.Public : Visibility.Private,
        preset: isPublic ? Preset.PublicChat : Preset.PrivateChat,
        creation_content: {
          type: 'm.space',
        },
      });

      toast.success(t('room.space.create.success', { name: trimmedName }));
      resetAndClose();
    } catch (err) {
      toast.error(
        t('room.space.create.failed', {
          error: getErrorMessage(err),
        })
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = async () => {
    const trimmedId = spaceId.trim();
    if (!trimmedId) {
      toast.error(t('room.space.join.idRequired'));
      return;
    }

    setJoinLoading(true);
    try {
      const client = getMatrixClient();
      await client.joinRoom(trimmedId);
      toast.success(t('room.space.join.success'));
      resetAndClose();
    } catch (err) {
      toast.error(
        t('room.space.join.failed', {
          error: getErrorMessage(err),
        })
      );
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

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      size="md"
      footer={
        tab === 'create' ? (
          <>
            <Button variant="secondary" onClick={resetAndClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={createLoading} onClick={handleCreate}>
              {t('room.space.create.title')}
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
      <div className={css.header}>
        <h2 className={css.title}>
          {tab === 'create' ? t('room.space.create.title') : t('room.space.join.title')}
        </h2>
      </div>

      {/* Tabs */}
      <div className={css.tabs}>
        <button
          className={tab === 'create' ? css.tabActive : css.tab}
          onClick={() => setTab('create')}
        >
          <PlusIcon size={14} className={css.iconMargin} />
          {t('room.space.create.titleShort')}
        </button>
        <button className={tab === 'join' ? css.tabActive : css.tab} onClick={() => setTab('join')}>
          <ArrowLineRightIcon size={14} className={css.iconMargin} />
          {t('room.space.join.titleShort')}
        </button>
      </div>

      {/* Create tab */}
      {tab === 'create' && (
        <div className={css.panel} onKeyDown={handleKeyDown}>
          <Input
            label={t('room.space.name')}
            placeholder={t('room.space.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
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
            onChange={setIsPublic}
            size="sm"
          />
        </div>
      )}

      {/* Join tab */}
      {tab === 'join' && (
        <div className={css.panel} onKeyDown={handleKeyDown}>
          <Input
            label={t('room.space.join.spaceId')}
            placeholder={t('room.space.join.spaceIdPlaceholder')}
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            autoFocus
          />
        </div>
      )}
    </Modal>
  );
}
