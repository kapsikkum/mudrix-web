import { useState, useCallback, useEffect } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { PlusIcon, TrashIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import type { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import { EventTimeline } from 'matrix-js-sdk';
import { confirmModalAtom } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Button, IconButton } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { Modal } from '@/app/components/Modal';
import { PackEditor, type PackData } from './PackEditor';
import * as css from './RoomSettingsEmojiSticker.css';
import * as panelCss from '@/app/components/Settings/Settings.css';

const PONIES_ROOM_EMOTES = 'im.ponies.room_emotes';

function getPackEvents(room: Room): { stateKey: string; content: Record<string, unknown> }[] {
  const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
  if (!state) return [];
  const events = state.getStateEvents(PONIES_ROOM_EMOTES as UntypedStateEventType) as MatrixEvent[];
  if (!Array.isArray(events)) return [];
  return events.map((ev) => ({
    stateKey: ev.getStateKey() ?? '',
    content: ev.getContent() as Record<string, unknown>,
  }));
}

function parsePacks(room: Room): PackData[] {
  return getPackEvents(room)
    .filter(({ stateKey }) => stateKey)
    .map(({ stateKey, content }) => {
      const pack = content?.pack as Record<string, unknown> | undefined;
      const imagesRaw = content?.images as Record<string, unknown> | undefined;
      const displayName: string = (pack?.display_name as string) || stateKey;
      const usage: string[] =
        Array.isArray(pack?.usage) && (pack.usage as string[]).length > 0
          ? (pack.usage as string[])
          : ['emoticon', 'sticker'];
      const images: Record<
        string,
        { shortcode: string; url: string; usage: string[]; body?: string; mimetype?: string }
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
          };
        }
      }
      return { stateKey, displayName, usage, images };
    });
}

interface Props {
  client: MatrixClient;
  roomId: string;
}

export function EmojiStickerPanel({ client, roomId }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [, setConfirm] = useAtom(confirmModalAtom);

  const room = client.getRoom(roomId);
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
      await client.sendStateEvent(
        roomId,
        PONIES_ROOM_EMOTES as UntypedStateEventType,
        {
          pack: { display_name: name, usage: ['emoticon', 'sticker'] },
          images: {},
        } as RawStateContent,
        stateKey
      );
      toast.success(t('room.settings.emojis.packCreated'));
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
        { url: string; usage?: string[]; body?: string; mimetype?: string }
      > = {};
      for (const [key, img] of Object.entries(updated.images)) {
        imagesContent[key] = {
          url: img.url,
          usage: updated.usage.length > 0 ? updated.usage : undefined,
          body: img.body ?? key,
          mimetype: img.mimetype,
        };
      }
      await client.sendStateEvent(
        roomId,
        PONIES_ROOM_EMOTES as UntypedStateEventType,
        {
          pack: { display_name: updated.displayName, usage: updated.usage },
          images: imagesContent,
        } as RawStateContent,
        updated.stateKey
      );
      setEditing(null);
    },
    [client, roomId]
  );

  const handleDelete = useCallback(
    (pack: PackData) => {
      setConfirm({
        open: true,
        title: t('room.settings.emojis.deletePack'),
        message: t('room.settings.emojis.deletePackConfirm', { name: pack.displayName }),
        danger: true,
        resolve: async (confirmed) => {
          if (!confirmed) return;
          try {
            await client.sendStateEvent(
              roomId,
              PONIES_ROOM_EMOTES as UntypedStateEventType,
              {} as RawStateContent,
              pack.stateKey
            );
            toast.success(t('room.settings.emojis.packDeleted'));
          } catch (err) {
            toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
          }
        },
      });
    },
    [client, roomId, setConfirm, toast, t]
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

      <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
        <PlusIcon size={14} className={panelCss.iconBefore} />
        {t('room.settings.emojis.createPack')}
      </Button>

      <div className={panelCss.divider} />

      {packs.length === 0 ? (
        <div className={css.emptyPacks}>{t('room.settings.emojis.noPacks')}</div>
      ) : (
        <div className={css.packList}>
          {packs.map((pack) => {
            const previews = Object.entries(pack.images).slice(0, 1);
            return (
              <div key={pack.stateKey} className={css.packCard}>
                {previews.length > 0 && (
                  <div className={css.packCardPreview}>
                    {previews.map(([key, img]) => (
                      <img
                        key={key}
                        src={
                          client.mxcUrlToHttp(
                            img.url,
                            28,
                            28,
                            undefined,
                            undefined,
                            undefined,
                            true
                          ) ?? ''
                        }
                        alt={key}
                        className={css.packCardPreviewImg}
                        title={key}
                      />
                    ))}
                  </div>
                )}
                <div className={css.packCardInfo}>
                  <span className={css.packCardName}>{pack.displayName}</span>
                </div>
                <div className={css.packCardActions}>
                  <IconButton
                    size="sm"
                    onClick={() => setEditing(pack)}
                    aria-label={t('common.edit')}
                  >
                    <PencilSimpleIcon size={14} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    onClick={() => handleDelete(pack)}
                    aria-label={t('common.delete')}
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
          onChange={(e) => setNewPackName(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter') handleCreate();
          }}
          autoFocus
        />
      </Modal>
    </div>
  );
}
