import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, StickerIcon, TrashIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import { useConfirm } from '@/app/hooks/useConfirm';
import { useToast } from '@/app/hooks/useToast';
import { useCanSendState } from '@/app/hooks/useCanSendState';
import { getErrorMessage } from '@/util/error';
import { Button, IconButton } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { Modal } from '@/app/components/Modal';
import {
  ROOM_PACK_STABLE,
  ROOM_PACK_UNSTABLE,
  mergePackImageMap,
  mergePackInfo,
  readRoomPackEvents,
} from '@/app/features/settings/emojis/imagePackTypes';
import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';
import { PackEditor, type PackData } from './PackEditor';
import * as css from './RoomSettingsEmojiSticker.css';
import * as panelCss from '@/app/components/Settings/Settings.css';

const PONIES_ROOM_EMOTES = 'im.ponies.room_emotes';

function getPackEvents(room: Room): { stateKey: string; content: Record<string, unknown> }[] {
  return Array.from(readRoomPackEvents(room).entries()).map(([stateKey, events]) => {
    const contents = events.map((ev) => ev.getContent() as Record<string, unknown>);
    const info = mergePackInfo(...contents);
    return {
      stateKey,
      content: {
        pack: {
          display_name: info.displayName,
          usage: info.usage,
          avatar_url: info.avatarUrl,
          attribution: info.attribution,
        },
        images: mergePackImageMap(...contents),
      },
    };
  });
}

function parsePacks(room: Room): PackData[] {
  return getPackEvents(room).map(({ stateKey, content }) => {
    const pack = content?.pack as Record<string, unknown> | undefined;
    const imagesRaw = content?.images as Record<string, unknown> | undefined;
    const displayName: string = (pack?.display_name as string) || stateKey;
    const usage: string[] =
      Array.isArray(pack?.usage) && (pack.usage as string[]).length > 0
        ? (pack.usage as string[])
        : ['emoticon', 'sticker'];
    const images: Record<
      string,
      {
        shortcode: string;
        url: string;
        usage: string[];
        body?: string;
        mimetype?: string;
        info?: Record<string, unknown>;
      }
    > = {};
    if (imagesRaw) {
      for (const [shortcode, img] of Object.entries(imagesRaw)) {
        const imgObj = img as Record<string, unknown>;
        images[shortcode] = {
          shortcode,
          url: (imgObj.url as string) || '',
          usage: Array.isArray(imgObj.usage) ? (imgObj.usage as string[]) : [],
          body: imgObj.body as string | undefined,
          mimetype: imgObj.mimetype as string | undefined,
          info:
            imgObj.info && typeof imgObj.info === 'object'
              ? (imgObj.info as Record<string, unknown>)
              : undefined,
        };
      }
    }
    return {
      stateKey,
      displayName,
      usage,
      images,
      avatarUrl: typeof pack?.avatar_url === 'string' ? pack.avatar_url : undefined,
      attribution: typeof pack?.attribution === 'string' ? pack.attribution : undefined,
    };
  });
}

interface Props {
  client: MatrixClient;
  roomId: string;
}

export function EmojiStickerPanel({ client, roomId }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirmDialog = useConfirm();

  const room = client.getRoom(roomId);
  const can = useCanSendState(room);
  const canManage = can(PONIES_ROOM_EMOTES);
  const [packs, setPacks] = useState<PackData[]>(() => (room ? parsePacks(room) : []));
  const [editing, setEditing] = useState<PackData | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPackName, setNewPackName] = useState('');

  useEffect(() => {
    if (!room) return;
    const update = () => setPacks(parsePacks(room));
    update();
    room.on('RoomState.events' as Parameters<Room['on']>[0], update);
    return () => {
      room.off('RoomState.events' as Parameters<Room['on']>[0], update);
    };
  }, [room]);

  const handleCreate = useCallback(async () => {
    const name = newPackName.trim();
    if (!name) {
      toast.error(t('room.settings.emojis.nameRequired'));
      return;
    }
    const stateKey = crypto.randomUUID();
    try {
      const content = {
        pack: { display_name: name, usage: ['emoticon', 'sticker'] },
        images: {},
      } as RawStateContent;
      await Promise.all([
        client.sendStateEvent(
          roomId,
          ROOM_PACK_UNSTABLE as UntypedStateEventType,
          content,
          stateKey
        ),
        client.sendStateEvent(roomId, ROOM_PACK_STABLE as UntypedStateEventType, content, stateKey),
      ]);
      setCreateModalOpen(false);
      setNewPackName('');
    } catch (err) {
      toast.error(t('room.settings.emojis.createFailed', { error: getErrorMessage(err) }));
    }
  }, [newPackName, client, roomId, toast, t]);

  const handleSavePack = useCallback(
    async (updated: PackData) => {
      const imagesContent: Record<
        string,
        {
          url: string;
          usage?: string[];
          body?: string;
          mimetype?: string;
          info?: Record<string, unknown>;
        }
      > = {};
      for (const [key, img] of Object.entries(updated.images)) {
        imagesContent[key] = {
          url: img.url,
          usage: img.usage.length > 0 ? img.usage : undefined,
          body: img.body ?? key,
          mimetype: img.mimetype,
          info: img.info,
        };
      }
      const content = {
        pack: {
          display_name: updated.displayName,
          usage: updated.usage,
          avatar_url: updated.avatarUrl,
          attribution: updated.attribution || undefined,
        },
        images: imagesContent,
      } as RawStateContent;
      await Promise.all([
        client.sendStateEvent(
          roomId,
          ROOM_PACK_UNSTABLE as UntypedStateEventType,
          content,
          updated.stateKey
        ),
        client.sendStateEvent(
          roomId,
          ROOM_PACK_STABLE as UntypedStateEventType,
          content,
          updated.stateKey
        ),
      ]);
      setEditing(null);
    },
    [client, roomId]
  );

  const handleDelete = useCallback(
    async (pack: PackData) => {
      const ok = await confirmDialog({
        title: t('room.settings.emojis.deletePack'),
        message: t('room.settings.emojis.deletePackConfirm', { name: pack.displayName }),
        danger: true,
      });
      if (!ok) return;
      try {
        const empty = {} as RawStateContent;
        await Promise.all([
          client.sendStateEvent(
            roomId,
            ROOM_PACK_UNSTABLE as UntypedStateEventType,
            empty,
            pack.stateKey
          ),
          client.sendStateEvent(
            roomId,
            ROOM_PACK_STABLE as UntypedStateEventType,
            empty,
            pack.stateKey
          ),
        ]);
      } catch (err) {
        toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, confirmDialog, roomId, toast, t]
  );

  if (!room) return null;

  if (editing) {
    return (
      <div>
        <h2 className={panelCss.panelTitle}>{t('room.settings.emojis.title')}</h2>
        <PackEditor
          client={client}
          roomId={roomId}
          pack={editing}
          onSave={handleSavePack}
          onBack={() => setEditing(null)}
          readOnly={!canManage}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className={panelCss.panelTitle}>{t('room.settings.emojis.title')}</h2>
      <p className={panelCss.settingNote} style={{ marginBottom: 16 }}>
        {t('room.settings.emojis.description')}
      </p>

      <Button variant="primary" onClick={() => setCreateModalOpen(true)} disabled={!canManage}>
        <PlusIcon size={14} className={panelCss.iconBefore} />
        {t('room.settings.emojis.createPack')}
      </Button>

      <div className={panelCss.divider} />

      {packs.length === 0 ? (
        <div className={css.emptyPacks}>{t('room.settings.emojis.noPacks')}</div>
      ) : (
        <div className={css.packList}>
          {packs.map((pack) => {
            const previewEntries = pack.avatarUrl ? [] : Object.entries(pack.images).slice(0, 1);
            const previewUrl = pack.avatarUrl ?? previewEntries[0]?.[1]?.url;
            return (
              <div key={pack.stateKey} className={css.packCard}>
                <div className={css.packCardPreview}>
                  {previewUrl ? (
                    <img
                      src={mxcUrlToHttp(client, previewUrl, 28, 28, 'scale', false, true, true)}
                      alt={pack.displayName}
                      className={css.packCardPreviewImg}
                      title={pack.displayName}
                    />
                  ) : (
                    <StickerIcon size={20} />
                  )}
                </div>
                <div className={css.packCardInfo}>
                  <span className={css.packCardName}>{pack.displayName}</span>
                </div>
                <div className={css.packCardActions}>
                  <IconButton
                    size="sm"
                    onClick={() => setEditing(pack)}
                    aria-label={t('common.edit')}
                    tooltip={t('common.edit')}
                    disabled={!canManage}
                  >
                    <PencilSimpleIcon size={14} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    onClick={() => handleDelete(pack)}
                    aria-label={t('common.delete')}
                    tooltip={t('common.delete')}
                    disabled={!canManage}
                  >
                    <TrashIcon size={14} />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setNewPackName('');
        }}
        title={t('room.settings.emojis.createPack')}
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setCreateModalOpen(false);
                setNewPackName('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreate}>
              {t('room.settings.emojis.createPack')}
            </Button>
          </div>
        }
      >
        <Input
          label={t('room.settings.emojis.packName')}
          placeholder={t('room.settings.emojis.packNamePlaceholder')}
          value={newPackName}
          disabled={!canManage}
          onChange={(e) => setNewPackName(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter') handleCreate();
          }}
          data-dialog-autofocus
        />
      </Modal>
    </div>
  );
}
