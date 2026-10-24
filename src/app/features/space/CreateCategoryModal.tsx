import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { EventType, Preset, Visibility } from 'matrix-js-sdk';
import { DEFAULT_TREE_POWER_LEVELS_TEMPLATE } from 'matrix-js-sdk/lib/models/MSC3089TreeSpace';
import type { ICreateRoomStateEvent } from 'matrix-js-sdk';
import { StackIcon } from '@phosphor-icons/react';
import { createCategoryOpenAtom } from '@/app/store/atoms';
import { getMatrixClient } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { ToggleRow } from '@/app/components/Toggle';
import * as css from './CreateSpaceModal.css';

/**
 * A category is a sub-space of the space it sits in. By default everyone in the parent space can
 * see it; a private one is invite-only.
 */
export function CreateCategoryModal() {
  const { t } = useTranslation();
  const [state, setState] = useAtom(createCategoryOpenAtom);
  const toast = useToast();
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const { open, parentSpaceId } = state;

  const close = () => {
    setState({ open: false });
    setName('');
    setIsPrivate(false);
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || !parentSpaceId) return;
    setLoading(true);
    try {
      const client = getMatrixClient();
      const powerLevels: Partial<typeof DEFAULT_TREE_POWER_LEVELS_TEMPLATE> = {
        ...DEFAULT_TREE_POWER_LEVELS_TEMPLATE,
      };
      delete powerLevels.users;
      const initial_state: ICreateRoomStateEvent[] = isPrivate
        ? []
        : [
            {
              type: 'm.room.join_rules',
              state_key: '',
              content: {
                join_rule: 'restricted',
                allow: [{ type: 'm.room_membership', room_id: parentSpaceId }],
              },
            },
          ];
      const { room_id: categoryId } = await client.createRoom({
        name: trimmed,
        visibility: Visibility.Private,
        preset: Preset.PrivateChat,
        power_level_content_override: powerLevels,
        creation_content: { type: 'm.space' },
        initial_state,
      });
      const domain = client.getDomain() ?? '';
      await client.sendStateEvent(
        parentSpaceId,
        EventType.SpaceChild,
        { via: [domain] },
        categoryId
      );
      await client.sendStateEvent(
        categoryId,
        EventType.SpaceParent,
        { via: [domain], canonical: true },
        parentSpaceId
      );
      close();
    } catch (err) {
      toast.error(t('room.space.create.failed', { error: getErrorMessage(err) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title={t('room.createCategory')}
      titleIcon={<StackIcon size={18} weight="fill" />}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={create}
            disabled={name.trim().length === 0}
          >
            {t('room.createCategory')}
          </Button>
        </>
      }
    >
      <div
        className={css.panel}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void create();
        }}
      >
        <Input
          label={t('room.categoryName')}
          placeholder={t('room.categoryNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-dialog-autofocus
          maxLength={255}
        />
        <ToggleRow
          label={t('room.categoryPrivate')}
          description={t('room.categoryPrivateNote')}
          checked={isPrivate}
          onChange={setIsPrivate}
        />
      </div>
    </Modal>
  );
}
