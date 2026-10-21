import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventType } from 'matrix-js-sdk';
import { XIcon } from '@phosphor-icons/react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Button, IconButton } from '@/app/components/Button';
import { Select } from '@/app/components/Select';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { isActiveSpaceChild, isSpace, roomStateMaybe } from '@/util/matrix';
import * as css from '@/app/components/Settings/Settings.css';
import { vars } from '@/theme/vars.css';

/**
 * Which spaces a room belongs to: remove it from one, or add it to another space the user is
 * allowed to manage. The space's `m.space.child` is what makes the membership; the room's own
 * `m.space.parent` is kept in step where the user may set it.
 */
export function RoomSpacesSection({ roomId }: { roomId: string }) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const [, setRevision] = useState(0);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  useMatrixEvent(
    client ?? null,
    'RoomState.events',
    useCallback((event: { getType?: () => string }) => {
      const type = event?.getType?.();
      if (type === EventType.SpaceChild || type === EventType.SpaceParent) {
        setRevision((n) => n + 1);
      }
    }, [])
  );

  if (!client) return null;
  const myId = client.getUserId() ?? '';
  const room = client.getRoom(roomId);
  const domain = client.getDomain() ?? '';

  const joinedSpaces = client
    .getRooms()
    .filter((r) => isSpace(r) && r.getMyMembership() === 'join');
  const isChildOf = (space: (typeof joinedSpaces)[number]) =>
    (roomStateMaybe(space)?.getStateEvents(EventType.SpaceChild) ?? [])
      .filter(isActiveSpaceChild)
      .some((e) => e.getStateKey() === roomId);
  const canManage = (space: (typeof joinedSpaces)[number]) =>
    roomStateMaybe(space)?.maySendStateEvent(EventType.SpaceChild, myId) ?? false;

  const parents = joinedSpaces.filter(isChildOf);
  const addable = joinedSpaces.filter((s) => s.roomId !== roomId && !isChildOf(s) && canManage(s));
  const canSetParent = room
    ? (roomStateMaybe(room)?.maySendStateEvent(EventType.SpaceParent, myId) ?? false)
    : false;

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await client.sendStateEvent(
        selected,
        EventType.SpaceChild,
        { via: [domain], suggested: false },
        roomId
      );
      if (canSetParent) {
        // Best effort: the child entry above is what makes the room show up in the space.
        await client
          .sendStateEvent(roomId, EventType.SpaceParent, { via: [domain] }, selected)
          .catch(() => {});
      }
      setSelected('');
    } catch (err) {
      toast.error(t('room.space.addExistingRoomFailed', { error: getErrorMessage(err) }));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (spaceId: string) => {
    setBusy(true);
    try {
      await client.sendStateEvent(
        spaceId,
        EventType.SpaceChild,
        {} as Record<string, never>,
        roomId
      );
      const parentEvent = room
        ? roomStateMaybe(room)?.getStateEvents(EventType.SpaceParent, spaceId)
        : null;
      if (canSetParent && parentEvent) {
        await client
          .sendStateEvent(roomId, EventType.SpaceParent, {} as Record<string, never>, spaceId)
          .catch(() => {});
      }
    } catch (err) {
      toast.error(t('room.space.removeFailed', { error: getErrorMessage(err) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={css.section}>
      <h3 className={css.sectionTitle}>{t('room.settings.spaces.title')}</h3>

      {parents.length === 0 && <p className={css.settingNote}>{t('room.settings.spaces.none')}</p>}
      {parents.map((space) => (
        <div
          key={space.roomId}
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
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: vars.color.textPrimary,
            }}
          >
            {space.name}
          </span>
          {canManage(space) && (
            <IconButton
              size="sm"
              onClick={() => remove(space.roomId)}
              disabled={busy}
              aria-label={t('room.space.removeRoom')}
              tooltip={t('room.space.removeRoom')}
            >
              <XIcon size={14} />
            </IconButton>
          )}
        </div>
      ))}

      {addable.length > 0 && (
        <div className={css.flexRowWrap} style={{ marginTop: 12 }}>
          <div className={css.flexOne}>
            <Select
              aria-label={t('room.settings.spaces.addLabel')}
              value={selected}
              options={[
                { value: '', label: t('room.settings.spaces.choose') },
                ...addable.map((s) => ({ value: s.roomId, label: s.name })),
              ]}
              onChange={setSelected}
            />
          </div>
          <Button variant="secondary" onClick={add} disabled={!selected || busy}>
            {t('room.settings.spaces.add')}
          </Button>
        </div>
      )}
    </div>
  );
}
