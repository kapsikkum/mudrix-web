import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, UploadSimpleIcon, XIcon, ImageIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Button, IconButton } from '@/app/components/Button';
import { Tooltip } from '@/app/components/Tooltip';
import { Input } from '@/app/components/Input';
import * as css from './RoomSettingsEmojiSticker.css';
import * as panelCss from '@/app/components/Settings/Settings.css';

export type ImageEntry = {
  shortcode: string;
  url: string;
  usage: string[];
  body?: string;
  mimetype?: string;
};

export type PackData = {
  stateKey: string;
  displayName: string;
  usage: string[];
  images: Record<string, ImageEntry>;
};

interface Props {
  client: MatrixClient;
  roomId: string;
  pack: PackData;
  onSave: (updated: PackData) => Promise<void>;
  onBack: () => void;
}

const SHORTCODE_RE = /^[a-zA-Z0-9_-]+$/;

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/apng'];

function isValidShortcode(s: string): boolean {
  return s.length > 0 && s.length <= 100 && SHORTCODE_RE.test(s);
}

function shortcodeFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'image'
  );
}

export function PackEditor({ client, roomId: _roomId, pack, onSave, onBack }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(pack.displayName);
  const initialUsage =
    pack.usage.includes('sticker') && pack.usage.includes('emoticon')
      ? 'both'
      : pack.usage.includes('sticker')
        ? 'sticker'
        : pack.usage.includes('emoticon')
          ? 'emoticon'
          : 'emoticon';
  const [usageMode, setUsageMode] = useState<'emoticon' | 'sticker' | 'both'>(initialUsage);
  const [images, setImages] = useState<Record<string, ImageEntry>>(pack.images);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingShortcode, setEditingShortcode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast.error(
          t(
            'room.settings.emojis.unsupportedFormat',
            'Unsupported format. Please use PNG, JPEG, GIF, WebP or APNG.'
          )
        );
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      setUploading(true);
      try {
        const { content_uri: mxcUrl } = await client.uploadContent(file, { name: file.name });
        const shortcode = shortcodeFromName(file.name.replace(/\.[^.]+$/, ''));
        let uniqueShortcode = shortcode;
        let idx = 1;
        while (uniqueShortcode in images) {
          idx += 1;
          uniqueShortcode = `${shortcode}_${idx}`;
        }
        const entry: ImageEntry = {
          shortcode: uniqueShortcode,
          url: mxcUrl,
          usage: [],
          mimetype: file.type || 'image/png',
        };
        setImages((prev) => ({ ...prev, [uniqueShortcode]: entry }));
      } catch (err) {
        toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [client, images, toast, t]
  );

  const handleRemoveImage = useCallback((key: string) => {
    setImages((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleStartEditShortcode = useCallback((key: string) => {
    setEditingShortcode(key);
    setEditValue(key);
  }, []);

  const handleFinishEditShortcode = useCallback(() => {
    if (!editingShortcode) {
      setEditingShortcode(null);
      return;
    }
    const newKey = editValue.trim();
    if (!newKey) {
      setEditingShortcode(null);
      return;
    }
    if (newKey === editingShortcode) {
      setEditingShortcode(null);
      return;
    }
    if (!isValidShortcode(newKey)) {
      toast.error(
        t(
          'room.settings.emojis.shortcodeInvalid',
          'Shortcodes may only contain letters, numbers, hyphens and underscores (max 100 chars).'
        )
      );
      setEditingShortcode(null);
      return;
    }
    if (newKey in images) {
      toast.error(t('room.settings.emojis.shortcodeTaken'));
      setEditingShortcode(null);
      return;
    }
    setImages((prev) => {
      const next = { ...prev };
      next[newKey] = { ...next[editingShortcode], shortcode: newKey };
      delete next[editingShortcode];
      return next;
    });
    setEditingShortcode(null);
  }, [editingShortcode, editValue, images, toast, t]);

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      toast.error(t('room.settings.emojis.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const usage: string[] = usageMode === 'both' ? ['emoticon', 'sticker'] : [usageMode];
      const processedImages: Record<string, ImageEntry> = {};
      for (const [key, img] of Object.entries(images)) {
        processedImages[key] = {
          shortcode: key,
          url: img.url,
          usage: img.usage,
          body: img.body ?? key,
          mimetype: img.mimetype,
        };
      }
      await onSave({
        stateKey: pack.stateKey,
        displayName: displayName.trim(),
        usage,
        images: processedImages,
      });
      toast.success(t('common.saved'));
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  }, [displayName, usageMode, images, pack.stateKey, onSave, toast, t]);

  const imageCount = Object.keys(images).length;

  return (
    <div>
      <div className={css.editorTitle}>
        <IconButton
          size="sm"
          onClick={onBack}
          aria-label={t('common.back')}
          tooltip={t('common.back')}
        >
          <ArrowLeftIcon size={16} />
        </IconButton>
        <span>{pack.displayName || t('room.settings.emojis.newPack')}</span>
      </div>

      <div className={panelCss.divider} />

      <div className={css.editorSection}>
        <Input
          label={t('room.settings.emojis.packName')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('room.settings.emojis.packNamePlaceholder')}
        />
      </div>

      <div className={css.editorSection}>
        <div
          style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            letterSpacing: '0.05em',
            marginBottom: 6,
          }}
        >
          {t('room.settings.emojis.usage')}
        </div>
        <select
          className={panelCss.select}
          value={usageMode}
          onChange={(e) => setUsageMode(e.target.value as 'emoticon' | 'sticker' | 'both')}
        >
          <option value="emoticon">{t('room.settings.emojis.usageEmoji')}</option>
          <option value="sticker">{t('room.settings.emojis.usageSticker')}</option>
          <option value="both">{t('room.settings.emojis.usageBoth')}</option>
        </select>
      </div>

      <div className={panelCss.divider} />

      <div className={css.editorSection}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {t('room.settings.emojis.images')} ({imageCount})
          </span>
          <Button
            variant="secondary"
            size="sm"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <UploadSimpleIcon size={14} className={panelCss.iconBefore} />
            {t('room.settings.emojis.addImage')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/apng"
            className={panelCss.hiddenInput}
            onChange={handleUpload}
          />
        </div>

        {imageCount === 0 ? (
          <div className={css.emptyPacks}>{t('room.settings.emojis.noImages')}</div>
        ) : (
          <div className={css.imageGrid}>
            {Object.entries(images).map(([key, img]) => (
              <div key={key} className={css.imageCard}>
                {img.url ? (
                  <img
                    src={
                      client.mxcUrlToHttp(img.url, 56, 56, 'scale', undefined, undefined, true) ??
                      ''
                    }
                    alt={key}
                    className={css.imagePreview}
                  />
                ) : (
                  <div
                    className={css.imagePreview}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ImageIcon size={20} />
                  </div>
                )}
                {editingShortcode === key ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleFinishEditShortcode}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishEditShortcode();
                      if (e.key === 'Escape') setEditingShortcode(null);
                    }}
                    autoFocus
                    style={{
                      width: '100%',
                      fontSize: '0.76rem',
                      textAlign: 'center',
                      border: '1px solid var(--color-accent)',
                      borderRadius: 4,
                      padding: '2px 4px',
                      background: 'var(--color-bg-input)',
                      color: 'var(--color-text-primary)',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <Tooltip content={t('room.settings.emojis.editShortcode')}>
                    <button
                      type="button"
                      className={css.imageShortcode}
                      onClick={() => handleStartEditShortcode(key)}
                      style={{ cursor: 'pointer', border: 'none', background: 'none' }}
                    >
                      :{key}:
                    </button>
                  </Tooltip>
                )}
                <Tooltip content={t('room.settings.emojis.removeImage')}>
                  <button
                    type="button"
                    className={css.imageRemoveBtn}
                    onClick={() => handleRemoveImage(key)}
                    aria-label={t('room.settings.emojis.removeImage')}
                  >
                    <XIcon size={12} weight="bold" />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={css.actions}>
        <Button variant="secondary" onClick={onBack}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" loading={saving} onClick={handleSave}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
