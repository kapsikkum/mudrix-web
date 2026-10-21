import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  StickerIcon,
  TrashIcon,
  PencilSimpleIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import { useConfirm } from '@/app/hooks/useConfirm';
import { useToast } from '@/app/hooks/useToast';
import { useCanSendState } from '@/app/hooks/useCanSendState';
import { getErrorMessage } from '@/util/error';
import { Button, IconButton } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { Select } from '@/app/components/Select';
import { Field } from '@/app/components/Field';
import { Modal } from '@/app/components/Modal';
import { vars } from '@/theme/vars.css';
import {
  ROOM_PACK_STABLE,
  ROOM_PACK_TYPES,
  ROOM_PACK_UNSTABLE,
  mergePackImageMap,
  mergePackInfo,
  readRoomPackEvents,
} from '@/app/features/settings/emojis/imagePackTypes';
import { AuthMediaImg } from '@/app/components/AuthMediaImg';
import { PackEditor, type ImageEntry, type PackData } from './PackEditor';
import {
  PACK_BUDGET_BYTES,
  buildPackContent,
  estimateEntryBytes,
  isTooLargeError,
  numberedPackName,
  sendPackStateEvents,
  shortcodeFromFile,
  splitImagesBySize,
  uploadFilesPooled,
  withRateLimitRetry,
  type UploadedImage,
  fileResumeKey,
} from './packContent';
import { PackBar } from './PackStatus';
import * as css from './RoomSettingsEmojiSticker.css';
import * as panelCss from '@/app/components/Settings/Settings.css';

const PONIES_ROOM_EMOTES = 'im.ponies.room_emotes';

/** Lightweight row for the pack list: the list never needs the full image map. */
interface PackListItem {
  stateKey: string;
  displayName: string;
  previewUrl?: string;
  imageCount: number;
}

function contentsOf(events: MatrixEvent[]): Record<string, unknown>[] {
  return events.map((ev) => ev.getContent() as Record<string, unknown>);
}

function listPacks(room: Room): PackListItem[] {
  return Array.from(readRoomPackEvents(room).entries()).map(([stateKey, events]) => {
    const contents = contentsOf(events);
    const info = mergePackInfo(...contents);
    const images = mergePackImageMap(...contents);
    const keys = Object.keys(images);
    return {
      stateKey,
      displayName: info.displayName || stateKey,
      previewUrl: info.avatarUrl ?? (keys.length > 0 ? images[keys[0]].url : undefined),
      imageCount: keys.length,
    };
  });
}

/** Full pack (with every image) for the editor. */
function parsePack(room: Room, stateKey: string): PackData | null {
  const events = readRoomPackEvents(room).get(stateKey);
  if (!events) return null;
  const contents = contentsOf(events);
  const info = mergePackInfo(...contents);
  const usage: string[] =
    info.usage && info.usage.length > 0 ? info.usage : ['emoticon', 'sticker'];
  const images: Record<string, ImageEntry> = {};
  for (const [shortcode, img] of Object.entries(mergePackImageMap(...contents))) {
    const imgObj = img as unknown as Record<string, unknown>;
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
  return {
    stateKey,
    displayName: info.displayName || stateKey,
    usage,
    images,
    avatarUrl: info.avatarUrl,
    attribution: info.attribution,
  };
}

const USAGE_OPTIONS = [
  { value: 'both', label: 'Emojis & Stickers' },
  { value: 'emoticon', label: 'Emojis only' },
  { value: 'sticker', label: 'Stickers only' },
  { value: 'profile_decoration', label: 'Avatar Decorations' },
  { value: 'profile_effect', label: 'Profile Effects' },
  { value: 'nameplate', label: 'Nameplates' },
  { value: 'profile_frame', label: 'Profile Frames' },
];

function usageModeToArray(mode: string): string[] {
  if (mode === 'both') return ['emoticon', 'sticker'];
  return [mode];
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
  const isSpace = room?.isSpaceRoom() ?? false;
  const can = useCanSendState(room);
  const canManage = can(PONIES_ROOM_EMOTES);
  const [packs, setPacks] = useState<PackListItem[]>(() => (room ? listPacks(room) : []));
  const [editing, setEditing] = useState<PackData | null>(null);

  // Create Pack Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  const [newPackUsage, setNewPackUsage] = useState('both');

  // Upload Pack Modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadPackName, setUploadPackName] = useState('');
  const [uploadPackUsage, setUploadPackUsage] = useState('both');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    phase: 'upload' | 'save';
    done: number;
    total: number;
    failed: number;
  } | null>(null);
  const [uploadFailed, setUploadFailed] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  // Uploads that already succeeded (by file), so retry / resume only uploads what is missing.
  const uploadedRef = useRef(new Map<string, UploadedImage>());
  // State keys for the packs of the current plan, so a retried save is idempotent.
  const planKeysRef = useRef<string[]>([]);

  useEffect(() => {
    if (!room) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Only pack events matter, and one save emits several: coalesce into a single re-read.
    const update = (ev?: MatrixEvent) => {
      if (ev && typeof ev.getType === 'function') {
        const type = ev.getType();
        if (type !== ROOM_PACK_TYPES[0] && type !== ROOM_PACK_TYPES[1]) return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPacks(listPacks(room)), 120);
    };
    setPacks(listPacks(room));
    room.on('RoomState.events' as Parameters<Room['on']>[0], update as never);
    return () => {
      if (timer) clearTimeout(timer);
      room.off('RoomState.events' as Parameters<Room['on']>[0], update as never);
    };
  }, [room]);

  useEffect(() => () => uploadAbortRef.current?.abort(), []);

  const canCreatePack = newPackName.trim().length > 0 && canManage;

  const handleCreate = useCallback(async () => {
    if (!canCreatePack) return;
    const name = newPackName.trim();
    const stateKey = crypto.randomUUID();
    try {
      const content = {
        pack: { display_name: name, usage: usageModeToArray(newPackUsage) },
        images: {},
      } as RawStateContent;
      await sendPackStateEvents(client, roomId, stateKey, content);
      setCreateModalOpen(false);
      setNewPackName('');
      setNewPackUsage('both');
    } catch (err) {
      toast.error(t('room.settings.emojis.createFailed', { error: getErrorMessage(err) }));
    }
  }, [canCreatePack, newPackName, newPackUsage, client, roomId, toast, t]);

  // Plan for the upload dialog: shortcodes, estimated size and how many packs it will take.
  const uploadPlan = useMemo(() => {
    const used = new Set<string>();
    const usage = usageModeToArray(uploadPackUsage);
    const domain = client.getDomain() ?? 'matrix.org';
    const entries = uploadFiles.map((file) => {
      const base = shortcodeFromFile(file.name, 'item');
      let shortcode = base;
      let counter = 1;
      while (used.has(shortcode)) {
        shortcode = `${base}_${counter++}`;
      }
      used.add(shortcode);
      return { file, shortcode, bytes: estimateEntryBytes(shortcode, usage, domain) };
    });
    let packCount = entries.length > 0 ? 1 : 0;
    let used2 = 400;
    for (const e of entries) {
      if (used2 + e.bytes > PACK_BUDGET_BYTES && used2 > 400) {
        packCount += 1;
        used2 = 400;
      }
      used2 += e.bytes;
    }
    return { entries, packCount, perPack: Math.ceil(entries.length / Math.max(packCount, 1)) };
  }, [uploadFiles, uploadPackUsage, client]);

  const resetUploadPlan = useCallback(() => {
    uploadedRef.current = new Map();
    planKeysRef.current = [];
    setUploadFailed([]);
  }, []);

  const handleUploadPack = useCallback(async () => {
    if (!uploadPackName.trim() || uploadFiles.length === 0 || !canManage) return;
    const name = uploadPackName.trim();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploading(true);
    setUploadFailed([]);
    setUploadProgress({ phase: 'upload', done: 0, total: uploadFiles.length, failed: 0 });

    try {
      // 1. Upload with bounded concurrency; already-uploaded files are skipped on retry.
      const result = await uploadFilesPooled(
        client,
        uploadPlan.entries.map((e) => e.file),
        {
          concurrency: 4,
          signal: controller.signal,
          done: uploadedRef.current,
          onProgress: (done, total, failed) =>
            setUploadProgress({ phase: 'upload', done, total, failed }),
        }
      );
      if (result.cancelled) {
        toast.error(
          t('room.settings.emojis.uploadCancelled', {
            done: result.uploaded.filter(Boolean).length,
            total: uploadFiles.length,
          })
        );
        return;
      }
      if (result.errors.size > 0) {
        setUploadFailed(
          uploadPlan.entries.filter((_, i) => result.errors.has(i)).map((e) => e.file)
        );
        toast.error(t('room.settings.emojis.uploadFailedSome', { count: result.errors.size }));
        return;
      }

      // 2. Build one pack, split it so every event stays under the Matrix size limit.
      const usage = usageModeToArray(uploadPackUsage);
      const images: Record<string, ImageEntry> = {};
      uploadPlan.entries.forEach((entry, i) => {
        const up = result.uploaded[i] as UploadedImage;
        images[entry.shortcode] = {
          shortcode: entry.shortcode,
          url: up.mxc,
          usage: [],
          body: entry.file.name.replace(/\.[^.]+$/, ''),
          mimetype: up.mimetype,
          info: up.info,
        };
      });
      const base: PackData = { stateKey: '', displayName: name, usage, images };
      const chunks = splitImagesBySize(base);
      while (planKeysRef.current.length < chunks.length) {
        planKeysRef.current.push(crypto.randomUUID());
      }

      // 3. Save the packs one after another (state events are rate limited).
      for (let i = 0; i < chunks.length; i += 1) {
        setUploadProgress({ phase: 'save', done: i, total: chunks.length, failed: 0 });
        const firstUrl = Object.values(chunks[i])[0]?.url;
        const content = buildPackContent({
          ...base,
          stateKey: planKeysRef.current[i],
          displayName: numberedPackName(name, i, chunks.length),
          images: chunks[i],
          avatarUrl: firstUrl,
        });

        await sendPackStateEvents(
          client,
          roomId,
          planKeysRef.current[i],
          content,
          controller.signal
        );
      }

      toast.success(
        t('room.settings.emojis.uploadPackDone', {
          name,
          count: uploadFiles.length,
          packs: chunks.length,
          target: isSpace
            ? t('room.settings.emojis.targetSpace')
            : t('room.settings.emojis.targetRoom'),
        })
      );
      resetUploadPlan();
      setUploadModalOpen(false);
      setUploadPackName('');
      setUploadFiles([]);
      setUploadPackUsage('both');
    } catch (err) {
      toast.error(
        isTooLargeError(err)
          ? t('room.settings.emojis.serverTooLarge')
          : t('room.settings.emojis.createFailed', { error: getErrorMessage(err) })
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
      uploadAbortRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [
    uploadPackName,
    uploadFiles,
    uploadPlan,
    canManage,
    uploadPackUsage,
    client,
    roomId,
    isSpace,
    resetUploadPlan,
    toast,
    t,
  ]);

  const handleSavePack = useCallback(
    async (updated: PackData) => {
      // Incremental: unchanged event types are not re-sent, and nothing waits for the sync echo.
      await sendPackStateEvents(client, roomId, updated.stateKey, buildPackContent(updated));
      setEditing(null);
    },
    [client, roomId]
  );

  const handleSplitPack = useCallback(
    async (parts: PackData[]) => {
      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        const stateKey = part.stateKey || crypto.randomUUID();
        // Packs are saved one after another; each already honours the rate limit.

        await sendPackStateEvents(client, roomId, stateKey, buildPackContent(part));
      }
      toast.success(t('room.settings.emojis.splitDone', { count: parts.length }));
      setEditing(null);
    },
    [client, roomId, toast, t]
  );

  const handleDelete = useCallback(
    async (pack: PackListItem) => {
      const ok = await confirmDialog({
        title: t('room.settings.emojis.deletePack'),
        message: t('room.settings.emojis.deletePackConfirm', { name: pack.displayName }),
        danger: true,
      });
      if (!ok) return;
      try {
        const empty = { images: {} } as RawStateContent;
        await Promise.all(
          [ROOM_PACK_UNSTABLE, ROOM_PACK_STABLE].map((type) =>
            withRateLimitRetry(() =>
              client.sendStateEvent(roomId, type as UntypedStateEventType, empty, pack.stateKey)
            )
          )
        );
      } catch (err) {
        toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, confirmDialog, roomId, toast, t]
  );

  const handleEdit = useCallback(
    (stateKey: string) => {
      if (!room) return;
      const full = parsePack(room, stateKey);
      if (full) setEditing(full);
    },
    [room]
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
          onSplit={handleSplitPack}
          onBack={() => setEditing(null)}
          readOnly={!canManage}
        />
      </div>
    );
  }

  const closeUploadModal = () => {
    if (uploading) return;
    setUploadModalOpen(false);
    setUploadPackName('');
    setUploadFiles([]);
    resetUploadPlan();
  };

  const hasPartialUpload = uploadedRef.current.size > 0 || uploadFailed.length > 0;

  return (
    <div>
      <h2 className={panelCss.panelTitle}>{t('room.settings.emojis.title')}</h2>
      <p className={panelCss.settingNote} style={{ marginBottom: 16 }}>
        {isSpace
          ? 'Manage custom emoji, sticker, and cosmetic packs for this space. Members and child rooms can use and subscribe to these packs.'
          : t('room.settings.emojis.description')}
      </p>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={() => setCreateModalOpen(true)} disabled={!canManage}>
          <PlusIcon size={14} className={panelCss.iconBefore} />
          {t('room.settings.emojis.createPack')}
        </Button>
        <Button variant="secondary" onClick={() => setUploadModalOpen(true)} disabled={!canManage}>
          <UploadSimpleIcon size={14} className={panelCss.iconBefore} />
          {isSpace ? 'Upload Pack to Space' : 'Upload Pack'}
        </Button>
      </div>

      <div className={panelCss.divider} />

      {packs.length === 0 ? (
        <div className={css.emptyPacks}>
          {isSpace
            ? 'No emoji, sticker, or cosmetic packs in this space yet.'
            : t('room.settings.emojis.noPacks')}
        </div>
      ) : (
        <div className={css.packList}>
          {packs.map((pack) => (
            <div key={pack.stateKey} className={css.packCard}>
              <div className={css.packCardPreview}>
                {pack.previewUrl ? (
                  <AuthMediaImg
                    client={client}
                    mxcUrl={pack.previewUrl}
                    width={28}
                    height={28}
                    lazy
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
                  onClick={() => handleEdit(pack.stateKey)}
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
                  <TrashIcon size={14} className={css.dangerIcon} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Pack Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setNewPackName('');
          setNewPackUsage('both');
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
                setNewPackUsage('both');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!canCreatePack}>
              {t('room.settings.emojis.createPack')}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
          <Field label={t('room.settings.emojis.usage')}>
            <Select value={newPackUsage} onChange={setNewPackUsage} options={USAGE_OPTIONS} />
          </Field>
        </div>
      </Modal>

      {/* Upload Pack Modal */}
      <Modal
        open={uploadModalOpen}
        onClose={closeUploadModal}
        title={isSpace ? 'Upload Pack to Space' : 'Upload Pack to Room'}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button
              variant="secondary"
              onClick={() => {
                if (uploading) uploadAbortRef.current?.abort();
                else closeUploadModal();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleUploadPack}
              loading={uploading}
              disabled={!uploadPackName.trim() || uploadFiles.length === 0 || !canManage}
            >
              {uploading
                ? t(
                    uploadProgress?.phase === 'save'
                      ? 'room.settings.emojis.savingPacksProgress'
                      : 'room.settings.emojis.uploadingProgress',
                    {
                      done: uploadProgress?.done ?? 0,
                      total: uploadProgress?.total ?? uploadFiles.length,
                    }
                  )
                : hasPartialUpload
                  ? t('room.settings.emojis.resumeUpload')
                  : t('room.settings.emojis.uploadAndCreate')}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input
            label={t('room.settings.emojis.packName')}
            placeholder="e.g. Space Cosmetics"
            value={uploadPackName}
            disabled={uploading || !canManage}
            onChange={(e) => setUploadPackName(e.target.value)}
          />
          <Field label={t('room.settings.emojis.usage')}>
            <Select
              value={uploadPackUsage}
              disabled={uploading}
              onChange={setUploadPackUsage}
              options={USAGE_OPTIONS}
            />
          </Field>
          <Field
            label="Pack Images"
            hint="Select image files (PNG, GIF, APNG, WebP, SVG). Files will be uploaded directly to the homeserver."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/png,image/jpeg,image/gif,image/webp,image/apng,image/svg+xml"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) {
                    resetUploadPlan();
                    setUploadFiles(files);
                    if (!uploadPackName.trim()) {
                      const firstBase = files[0].name.replace(/\.[^.]+$/, '');
                      setUploadPackName(firstBase);
                    }
                  }
                }}
              />
              <Button
                variant="secondary"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadSimpleIcon size={16} className={panelCss.iconBefore} />
                {uploadFiles.length > 0
                  ? `${uploadFiles.length} images selected (Click to change)`
                  : 'Select Images...'}
              </Button>
              {uploadFiles.length > 0 && uploadPlan.packCount > 1 && (
                <span style={{ fontSize: '0.78rem', color: vars.color.warning }}>
                  {t('room.settings.emojis.willSplit', {
                    packs: uploadPlan.packCount,
                    per: uploadPlan.perPack,
                  })}
                </span>
              )}
              {uploadProgress && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '0.8rem', color: vars.color.textSecondary }}>
                    {t(
                      uploadProgress.phase === 'save'
                        ? 'room.settings.emojis.savingPacksProgress'
                        : 'room.settings.emojis.uploadingProgress',
                      { done: uploadProgress.done, total: uploadProgress.total }
                    )}
                    {uploadProgress.failed > 0 &&
                      ' · ' +
                        t('room.settings.emojis.uploadFailedSome', {
                          count: uploadProgress.failed,
                        })}
                  </span>
                  <PackBar value={uploadProgress.done} max={uploadProgress.total} />
                </div>
              )}
              {!uploading && uploadFailed.length > 0 && (
                <span style={{ fontSize: '0.78rem', color: vars.color.danger }}>
                  {t('room.settings.emojis.retryFailed', { count: uploadFailed.length })}
                </span>
              )}
              {uploadFiles.length > 0 && (
                <div
                  style={{
                    maxHeight: '140px',
                    overflowY: 'auto',
                    fontSize: '0.78rem',
                    color: vars.color.textSecondary,
                    backgroundColor: vars.color.bgTertiary,
                    padding: '8px 12px',
                    borderRadius: vars.radius.sm,
                    border: `1px solid ${vars.color.border}`,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    Selected files ({uploadFiles.length}):
                  </div>
                  {uploadFiles.map((f) => {
                    const done = uploadedRef.current.has(fileResumeKey(f));
                    return (
                      <div
                        key={fileResumeKey(f)}
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          opacity: done ? 0.6 : 1,
                        }}
                      >
                        • {f.name} ({(f.size / 1024).toFixed(1)} KB)
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
