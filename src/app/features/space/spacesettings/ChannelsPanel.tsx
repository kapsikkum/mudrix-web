import { useMemo } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  HashIcon,
  SpeakerHighIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { createCategoryOpenAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Button, IconButton } from '@/app/components/Button';
import { Select } from '@/app/components/Select';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { canSetVoiceChannel, setVoiceChannel } from '@/app/features/room/voiceChannel';
import {
  useSpaceHierarchy,
  type HierarchyRoomItem,
  type HierarchySpaceItem,
} from '@/app/features/room/useSpaceHierarchy';
import { canOrderSpace, moveRoomToCategory, moveSpaceChild } from '../spaceOrder';
import * as css from '@/app/components/Settings/Settings.css';
import * as chCss from './Channels.css';

interface Category {
  space: HierarchySpaceItem;
  rooms: HierarchyRoomItem[];
}

/** Channel and category management for a space: order, voice or text, and which category each is in. */
export function ChannelsPanel({ spaceId }: { spaceId: string }) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const setCreateCategory = useSetAtom(createCategoryOpenAtom);
  const items = useSpaceHierarchy(spaceId, undefined, true);

  const categories = useMemo(() => {
    const out: Category[] = [];
    items.forEach((item) => {
      if (item.kind === 'space') out.push({ space: item, rooms: [] });
      else out[out.length - 1]?.rooms.push(item);
    });
    return out;
  }, [items]);

  if (!client) return null;
  const canCreate = canOrderSpace(client, spaceId);

  const fail = (err: unknown) => toast.error(t('room.moveFailed', { error: getErrorMessage(err) }));
  const targets = categories
    .filter((c) => canOrderSpace(client, c.space.roomId))
    .map((c) => ({
      id: c.space.roomId,
      name: c.space.isRoot ? t('room.noCategory') : c.space.name,
    }));

  return (
    <div className={css.section}>
      <h2 className={css.panelTitle}>{t('room.settings.channels.title')}</h2>
      <p className={css.settingNote}>{t('room.settings.channels.intro')}</p>
      {canCreate && (
        <div className={chCss.toolbar}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreateCategory({ open: true, parentSpaceId: spaceId })}
          >
            <StackIcon size={14} className={css.iconBefore} />
            {t('room.createCategory')}
          </Button>
        </div>
      )}
      {categories.map(({ space, rooms }) => {
        const editable = canOrderSpace(client, space.roomId);
        // Text channels come before voice channels, and each kind is ordered on its own.
        const groups = [
          rooms.filter((r) => !r.entry.hasVoiceRoom),
          rooms.filter((r) => r.entry.hasVoiceRoom),
        ];
        const others = targets.filter((tg) => tg.id !== space.roomId);
        return (
          <div key={space.roomId} className={chCss.category}>
            <h3 className={chCss.categoryName}>
              {space.isRoot ? t('room.noCategory') : space.name}
            </h3>
            {rooms.length === 0 && (
              <p className={css.settingNote}>{t('room.settings.channels.empty')}</p>
            )}
            {groups.map((group) =>
              group.map((room, index) => {
                const voice = room.entry.hasVoiceRoom;
                const ids = group.map((r) => r.roomId);
                return (
                  <div key={room.roomId} className={chCss.row}>
                    {voice ? <SpeakerHighIcon size={16} /> : <HashIcon size={16} />}
                    <span className={chCss.rowName}>
                      {client.getRoom(room.roomId)?.name ?? room.entry.name}
                    </span>
                    {editable && (
                      <>
                        <IconButton
                          aria-label={t('room.moveUp')}
                          disabled={index === 0}
                          onClick={() =>
                            moveSpaceChild(client, space.roomId, ids, room.roomId, -1).catch(fail)
                          }
                        >
                          <ArrowUpIcon size={14} />
                        </IconButton>
                        <IconButton
                          aria-label={t('room.moveDown')}
                          disabled={index === group.length - 1}
                          onClick={() =>
                            moveSpaceChild(client, space.roomId, ids, room.roomId, 1).catch(fail)
                          }
                        >
                          <ArrowDownIcon size={14} />
                        </IconButton>
                        {canSetVoiceChannel(client, room.roomId) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setVoiceChannel(client, room.roomId, !voice).catch((err) =>
                                toast.error(
                                  t('room.voiceChannelFailed', { error: getErrorMessage(err) })
                                )
                              )
                            }
                          >
                            {voice ? t('room.makeTextChannel') : t('room.makeVoiceChannel')}
                          </Button>
                        )}
                        {others.length > 0 && (
                          <Select<string>
                            aria-label={t('room.settings.channels.category')}
                            value=""
                            options={[
                              { value: '', label: t('room.settings.channels.moveTo') },
                              ...others.map((o) => ({ value: o.id, label: o.name })),
                            ]}
                            onChange={(target) => {
                              if (target)
                                moveRoomToCategory(client, room.roomId, space.roomId, target).catch(
                                  fail
                                );
                            }}
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}
