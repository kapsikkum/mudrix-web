import { useCallback, useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { EventType } from 'matrix-js-sdk';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  HashIcon,
  PlusIcon,
  StackIcon,
  XIcon,
} from '@phosphor-icons/react';
import { addRoomToSpaceAtom, createRoomOpenAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Button, IconButton } from '@/app/components/Button';
import { Toggle } from '@/app/components/Toggle';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { isActiveSpaceChild, roomStateMaybe } from '@/util/matrix';
import {
  canOrderSpace,
  compareSpaceChildren,
  moveSpaceChild,
  validChildOrder,
} from '../spaceOrder';
import * as css from '@/app/components/Settings/Settings.css';
import * as chCss from './Channels.css';

interface Child {
  roomId: string;
  name: string;
  isSpace: boolean;
  suggested: boolean;
}

/**
 * The rooms of a Matrix style space, managed the way Matrix does it: a plain list you can add
 * existing rooms to, create rooms in, take rooms out of, and mark as suggested. There are no
 * categories or voice channels here; those are part of the Modern style.
 */
export function MatrixRoomsPanel({ spaceId }: { spaceId: string }) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const setCreateRoom = useSetAtom(createRoomOpenAtom);
  const setAddRoom = useSetAtom(addRoomToSpaceAtom);
  const [revision, setRevision] = useState(0);

  useMatrixEvent(
    client ?? null,
    'RoomState.events',
    useCallback(
      (event: { getType?: () => string; getRoomId?: () => string | undefined }) => {
        if (event?.getType?.() === EventType.SpaceChild && event.getRoomId?.() === spaceId) {
          setRevision((n) => n + 1);
        }
      },
      [spaceId]
    )
  );

  const children = useMemo<Child[]>(() => {
    if (!client) return [];
    const events = roomStateMaybe(client.getRoom(spaceId))
      ?.getStateEvents(EventType.SpaceChild)
      .filter(isActiveSpaceChild);
    return (events ?? [])
      .map((e) => {
        const roomId = e.getStateKey() ?? '';
        const content = e.getContent() as { order?: unknown; suggested?: unknown };
        const room = client.getRoom(roomId);
        return {
          order: {
            roomId,
            order: validChildOrder(content.order),
            ts: e.getTs(),
          },
          child: {
            roomId,
            name: room?.name ?? roomId,
            isSpace: room?.isSpaceRoom() ?? false,
            suggested: content.suggested === true,
          },
        };
      })
      .filter((c) => c.order.roomId)
      .sort((a, b) => compareSpaceChildren(a.order, b.order))
      .map((c) => c.child);
    // `revision` changes whenever the space's children do
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, spaceId, revision]);

  if (!client) return null;
  const editable = canOrderSpace(client, spaceId);
  const space = client.getRoom(spaceId);
  const fail = (err: unknown) => toast.error(t('room.moveFailed', { error: getErrorMessage(err) }));

  const setSuggested = async (child: Child, suggested: boolean) => {
    const current = roomStateMaybe(space)?.getStateEvents(EventType.SpaceChild, child.roomId);
    const content = (Array.isArray(current) ? current[0] : current)?.getContent() ?? {};
    try {
      await client.sendStateEvent(
        spaceId,
        EventType.SpaceChild,
        { ...content, suggested },
        child.roomId
      );
    } catch (err) {
      toast.error(t('common.error', { error: getErrorMessage(err) }));
    }
  };

  const remove = async (child: Child) => {
    try {
      await client.sendStateEvent(
        spaceId,
        EventType.SpaceChild,
        {} as Record<string, never>,
        child.roomId
      );
    } catch (err) {
      toast.error(t('room.space.removeFailed', { error: getErrorMessage(err) }));
    }
  };

  const ids = children.map((c) => c.roomId);
  const spaceName = space?.name ?? '';

  return (
    <div className={css.section}>
      <h2 className={css.panelTitle}>{t('room.settings.channels.title')}</h2>
      <p className={css.settingNote}>{t('room.settings.channels.matrixIntro')}</p>
      {editable && (
        <div className={chCss.toolbar}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAddRoom({ open: true, spaceId, spaceName })}
          >
            <PlusIcon size={14} className={css.iconBefore} />
            {t('room.space.addExistingRoom')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreateRoom({ open: true, spaceId, spaceName })}
          >
            <HashIcon size={14} className={css.iconBefore} />
            {t('room.settings.channels.createRoom')}
          </Button>
        </div>
      )}
      {children.length === 0 && (
        <p className={css.settingNote}>{t('room.settings.channels.empty')}</p>
      )}
      {children.map((child, index) => (
        <div key={child.roomId} className={chCss.row} data-testid="matrix-room-row">
          <div className={chCss.head}>
            {child.isSpace ? <StackIcon size={16} /> : <HashIcon size={16} />}
            <span className={chCss.rowName}>{child.name}</span>
            {editable && (
              <>
                <span className={css.permRowRole}>{t('room.suggested')}</span>
                <Toggle
                  size="sm"
                  checked={child.suggested}
                  ariaLabel={t('room.suggested')}
                  onChange={(on) => setSuggested(child, on)}
                />
                <IconButton
                  aria-label={t('room.moveUp')}
                  disabled={index === 0}
                  onClick={() => moveSpaceChild(client, spaceId, ids, child.roomId, -1).catch(fail)}
                >
                  <ArrowUpIcon size={14} />
                </IconButton>
                <IconButton
                  aria-label={t('room.moveDown')}
                  disabled={index === children.length - 1}
                  onClick={() => moveSpaceChild(client, spaceId, ids, child.roomId, 1).catch(fail)}
                >
                  <ArrowDownIcon size={14} />
                </IconButton>
                <IconButton
                  danger
                  aria-label={t('room.space.removeRoom')}
                  tooltip={t('room.space.removeRoom')}
                  onClick={() => remove(child)}
                >
                  <XIcon size={14} />
                </IconButton>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
