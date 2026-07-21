import { useCallback, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { EventType } from 'matrix-js-sdk';
import { MagnifyingGlassIcon, CubeIcon } from '@phosphor-icons/react';
import { addRoomToSpaceAtom } from '@/app/store/atoms';
import { getMatrixClient } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { formatUserId, isDmRoom, isSpace, roomState } from '@/util/matrix';
import { Modal } from '@/app/components/Modal';
import { Avatar } from '@/app/components/Avatar';
import * as css from './AddRoomToSpaceModal.css';

interface RoomEntry {
  roomId: string;
  name: string;
  isDm: boolean;
}

export function AddRoomToSpaceModal() {
  const { t } = useTranslation();
  const [state, setState] = useAtom(addRoomToSpaceAtom);
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const open = state?.open ?? false;
  const spaceId = state?.spaceId ?? '';
  const spaceName = state?.spaceName ?? '';

  const close = useCallback(() => {
    setState(null);
    setQuery('');
    setLoading(null);
  }, [setState]);

  const client = getMatrixClient();

  const roomEntries = useMemo(() => {
    if (!client || !spaceId) return [];
    const space = client.getRoom(spaceId);
    if (!space) return [];

    const childState = roomState(space).getStateEvents(EventType.SpaceChild);
    const childIds = new Set<string>();
    for (const ev of Array.isArray(childState) ? childState : [childState]) {
      const key = ev?.getStateKey();
      if (key) childIds.add(key);
    }

    const joinedOrInvited = new Set(['join', 'invite']);
    const entries: RoomEntry[] = [];

    for (const room of client.getRooms()) {
      if (!joinedOrInvited.has(room.getMyMembership())) continue;
      if (isSpace(room)) continue;
      if (childIds.has(room.roomId)) continue;
      if (roomState(room).getStateEvents('m.room.tombstone', '')) continue;

      const dm = isDmRoom(room, client);
      const name = dm
        ? (() => {
            const inviter = room.getDMInviter();
            if (inviter) {
              const member = room.getMember(inviter);
              return member?.name || formatUserId(inviter);
            }
            return room.name || '(unknown)';
          })()
        : room.name || '(unknown)';

      entries.push({ roomId: room.roomId, name, isDm: dm });
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    return entries;
  }, [client, spaceId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return roomEntries;
    return roomEntries.filter((r) => r.name.toLowerCase().includes(q));
  }, [query, roomEntries]);

  const handleSelect = useCallback(
    async (entry: RoomEntry) => {
      if (loading) return;
      setLoading(entry.roomId);
      try {
        const domain = client.getDomain() ?? '';
        await client.sendStateEvent(spaceId, EventType.SpaceChild, { via: [domain] }, entry.roomId);
        await client.sendStateEvent(
          entry.roomId,
          EventType.SpaceParent,
          { via: [domain], canonical: true },
          spaceId
        );
        toast.success(t('room.space.addExistingRoomSuccess', { name: entry.name }));
        close();
      } catch (err) {
        toast.error(t('room.space.addExistingRoomFailed', { error: getErrorMessage(err) }));
      } finally {
        setLoading(null);
      }
    },
    [client, spaceId, loading, toast, t, close]
  );

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={t('room.space.addExistingRoom', { name: spaceName })}
      titleIcon={<CubeIcon size={18} />}
    >
      <div className={css.container}>
        <div className={css.searchWrapper}>
          <span className={css.searchIcon}>
            <MagnifyingGlassIcon size={14} />
          </span>
          <input
            className={css.searchInput}
            type="search"
            placeholder={t('room.space.addExistingRoomSearchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className={css.roomList}>
          {filtered.length === 0 ? (
            <div className={css.empty}>
              {query
                ? t('room.space.addExistingRoomNoResults')
                : t('room.space.addExistingRoomEmpty')}
            </div>
          ) : (
            filtered.map((entry) => {
              const room = client.getRoom(entry.roomId);
              const avatarMxc = room?.getMxcAvatarUrl() ?? null;
              return (
                <div
                  key={entry.roomId}
                  className={`${css.roomItem}${loading === entry.roomId ? ` ${css.roomItemLoading}` : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(entry)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(entry);
                    }
                  }}
                >
                  <Avatar name={entry.name} mxcUrl={avatarMxc} client={client} size="sm" />
                  <span className={css.roomItemName}>{entry.name}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
