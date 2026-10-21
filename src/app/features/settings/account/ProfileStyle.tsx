import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  SmileyIcon,
  SparkleIcon,
  UserCircleIcon,
  ArrowCounterClockwiseIcon,
  UploadSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Button } from '@/app/components/Button';
import { Field } from '@/app/components/Field';
import { Input } from '@/app/components/Input';
import { Select } from '@/app/components/Select';
import { Modal } from '@/app/components/Modal';
import { Avatar } from '@/app/components/Avatar';
import { useToast } from '@/app/hooks/useToast';
import { useInView } from '@/app/hooks/useInView';
import { useProfile } from '@/app/hooks/useProfile';
import {
  useDecorationPacks,
  useEffectPacks,
  useFavoritePacks,
  saveFavoritePacks,
  lookupPackImage,
  uploadUserDecoration,
  deleteUserDecoration,
  uploadUserEffect,
  deleteUserEffect,
  type DecorationPackImage,
  type EffectPackImage,
  type RoomPackSummary,
} from '@/app/hooks/useUserPacks';
import { FavoritePacksSelect } from '@/app/features/settings/emojis/SelectFavoritePacksModal';
import {
  useActiveStatus,
  useExtendedProfile,
  useExtendedProfileMutations,
  useExtendedProfileSupport,
} from '@/app/hooks/useExtendedProfile';
import { useUserBannerBlob } from '@/app/hooks/useUserBanner';
import { CustomStatusModal } from '@/app/features/profile/CustomStatusModal';
import * as cardCss from '@/app/features/profile/ProfileCard.css';
import {
  DECORATION_LABEL_KEYS,
  DecoratedAvatar,
  MudrixUserBadge,
  StatusPill,
  useDecorationSrc,
  useEffectSrc,
} from '@/app/features/profile/ProfileCosmetics';
import { vars } from '@/theme/vars.css';
import { ProfileEffect } from '@/app/features/profile/ProfileEffect';
import { getErrorMessage } from '@/util/error';
import {
  ACCENT_PRESETS,
  BUILTIN_DECORATION_IDS,
  BUILTIN_PROFILE_EFFECT_IDS,
  accentGradient,
  normalizeHex,
  readableTextColor,
  type AvatarDecorationId,
  type ProfileEffectId,
} from '@/util/profileCosmetics';
import { formatPronouns } from '@/util/profileFields';
import * as settingsCss from '@/app/components/Settings/Settings.css';
import * as css from './ProfileStyle.css';

const DEFAULT_PICKER_COLOR = '#5865f2';

const BUILTIN_EFFECT_LABELS: Record<string, string> = {
  'falling-stars': 'profile.effect.fallingStars',
  hearts: 'profile.effect.hearts',
  snow: 'profile.effect.snow',
  sparkles: 'profile.effect.sparkles',
};

interface DecorationOptionProps {
  id: string | null;
  label: string;
  isSelected: boolean;
  isCustomUpload?: boolean;
  /** Extra tooltip text, e.g. that the pack is no longer subscribed. */
  hint?: string;
  client: MatrixClient | null;
  onSelect: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

function DecorationOptionItem({
  id,
  label,
  isSelected,
  isCustomUpload,
  hint,
  client,
  onSelect,
  onDelete,
}: DecorationOptionProps) {
  const { t } = useTranslation();
  const [viewRef, inView] = useInView<HTMLDivElement>();
  const [hovered, setHovered] = useState(false);
  // Grid tiles load a small still thumbnail, and only while on screen. The full animated media
  // is fetched (one at a time) only for the hovered or selected tile.
  const thumbSrc = useDecorationSrc(id, client, { thumb: 96, enabled: inView });
  const fullSrc = useDecorationSrc(id, client, { enabled: inView && (hovered || isSelected) });
  const src = fullSrc ?? thumbSrc;

  return (
    <div
      ref={viewRef}
      className={css.decorationOptionWrap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className={css.decorationOption}
        aria-pressed={isSelected}
        onClick={onSelect}
        title={hint ? label + ' - ' + hint : label}
      >
        <span className={css.decorationPreview}>
          <span className={css.decorationPreviewAvatar} />
          {id && src && (
            <img
              className={cardCss.decoration}
              src={src}
              alt=""
              loading="lazy"
              draggable={false}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          )}
        </span>
        <span className={css.decorationLabel}>{label}</span>
      </button>
      {isCustomUpload && id && onDelete && (
        <button
          type="button"
          className={css.deleteCustomBtn}
          title={t('profile.decoration.deleteUploaded')}
          onClick={onDelete}
        >
          <TrashIcon size={11} />
        </button>
      )}
    </div>
  );
}

interface EffectOptionProps {
  id: string | null;
  label: string;
  category: string;
  isSelected: boolean;
  isCustomUpload?: boolean;
  hint?: string;
  client: MatrixClient | null;
  onSelect: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

function EffectOptionItem({
  id,
  label,
  category,
  isSelected,
  isCustomUpload,
  hint,
  client,
  onSelect,
  onDelete,
}: EffectOptionProps) {
  const { t } = useTranslation();
  const [viewRef, inView] = useInView<HTMLDivElement>();
  const [hovered, setHovered] = useState(false);
  const thumbSrc = useEffectSrc(id, client, { thumb: 144, enabled: inView });
  const fullSrc = useEffectSrc(id, client, { enabled: inView && (hovered || isSelected) });
  const src = fullSrc ?? thumbSrc;

  return (
    <div
      ref={viewRef}
      className={css.decorationOptionWrap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className={css.effectOption}
        aria-pressed={isSelected}
        onClick={onSelect}
        title={hint ? label + ' - ' + hint : label}
      >
        {src ? (
          <img
            className={css.effectOptionThumb}
            src={src}
            alt=""
            loading="lazy"
            draggable={false}
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            className={css.effectOptionThumb}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SparkleIcon size={28} style={{ color: '#a78bfa' }} />
          </div>
        )}
        <span className={css.effectOptionTitle}>{label}</span>
        <span className={css.effectOptionCategory}>{category}</span>
      </button>
      {isCustomUpload && id && onDelete && (
        <button
          type="button"
          className={css.deleteCustomBtn}
          title={t('profile.effect.deleteUploaded')}
          onClick={onDelete}
        >
          <TrashIcon size={11} />
        </button>
      )}
    </div>
  );
}

function EffectCosmeticThumb({
  effect,
  client,
}: {
  effect: ProfileEffectId | null;
  client: MatrixClient | null;
}) {
  const src = useEffectSrc(effect, client);
  if (!effect) {
    return <SparkleIcon size={24} style={{ color: vars.color.textMuted }} />;
  }
  if (src) {
    return <img className={css.cosmeticThumbImg} src={src} alt="" />;
  }
  return <SparkleIcon size={24} style={{ color: '#a78bfa' }} />;
}

/**
 * Account settings for profile personalization: custom status, accent colour, avatar decoration
 * and profile effect, with a real-time Discord-style preview window. The Mudrix-user badge is
 * not configurable here - it's set automatically by useEnsureMudrixUserFlag.
 */
export function ProfileStyle() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const { supported, loading: supportLoading } = useExtendedProfileSupport(client);
  const myId = client?.getUserId() ?? null;
  const { data: fields } = useExtendedProfile(client, myId);
  const { profile: ownProfile } = useProfile(client!);
  const { data: bannerSrc } = useUserBannerBlob(client, fields?.bannerMxc);
  const { saveFields, busy } = useExtendedProfileMutations(client);
  const status = useActiveStatus(fields?.status);

  const [statusOpen, setStatusOpen] = useState(false);
  const [accent, setAccent] = useState('');
  const [decoration, setDecoration] = useState<AvatarDecorationId | null>(null);
  const [effect, setEffect] = useState<ProfileEffectId | null>(null);

  // Modals for choosing cosmetics
  const [decorationModalOpen, setDecorationModalOpen] = useState(false);
  const [effectModalOpen, setEffectModalOpen] = useState(false);

  // Filter state for decoration modal
  const [decorationSearch, setDecorationSearch] = useState('');
  const [decorationCategory, setDecorationCategory] = useState('all');

  // Filter state for effect modal
  const [effectSearch, setEffectSearch] = useState('');
  const [effectCategory, setEffectCategory] = useState('all');

  const decorationPacks = useDecorationPacks(client);
  const effectPacks = useEffectPacks(client);
  const favoritePacks = useFavoritePacks(client);
  const [uploadingDeco, setUploadingDeco] = useState(false);
  const [uploadingEffect, setUploadingEffect] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectFileInputRef = useRef<HTMLInputElement>(null);

  const customDecorationsMap = useMemo(() => {
    const map = new Map<string, DecorationPackImage>();
    for (const group of decorationPacks) {
      for (const item of group.decorations) {
        map.set(item.id, item);
      }
    }
    return map;
  }, [decorationPacks]);

  const customEffectsMap = useMemo(() => {
    const map = new Map<string, EffectPackImage>();
    for (const group of effectPacks) {
      for (const item of group.effects) {
        map.set(item.id, item);
      }
    }
    return map;
  }, [effectPacks]);

  const myUploadsLabel = t('profile.cosmetics.myUploads');

  const decorationCategories = useMemo(() => {
    const packCategories = decorationPacks.map((p) => ({
      value: `pack:${p.category}`,
      label: p.category === 'My Uploads' ? `📁 ${myUploadsLabel}` : `📦 ${p.category}`,
    }));

    return [
      { value: 'all', label: t('profile.cosmetics.allCategories') },
      ...packCategories,
      { value: 'builtin', label: t('profile.cosmetics.builtin') },
    ];
  }, [decorationPacks, myUploadsLabel, t]);

  const effectCategories = useMemo(() => {
    const packCategories = effectPacks.map((p) => ({
      value: `pack:${p.category}`,
      label: p.category === 'My Uploads' ? `📁 ${myUploadsLabel}` : `📦 ${p.category}`,
    }));

    return [
      { value: 'all', label: t('profile.cosmetics.allCategories') },
      ...packCategories,
      { value: 'builtin', label: t('profile.cosmetics.builtinParticles') },
    ];
  }, [effectPacks, myUploadsLabel, t]);

  // The current selection may come from a pack the user has since unsubscribed from. Keep it
  // visible (and selectable) instead of silently dropping it from the picker.
  const orphanDecoration = useMemo(() => {
    if (!client || !decoration || !decoration.startsWith('mxc://')) return null;
    if (customDecorationsMap.has(decoration)) return null;
    const ref = lookupPackImage(client, decoration);
    return { id: decoration, name: ref?.name ?? null, packName: ref?.packName ?? null };
  }, [client, decoration, customDecorationsMap]);

  const orphanEffect = useMemo(() => {
    if (!client || !effect || !effect.startsWith('mxc://')) return null;
    if (customEffectsMap.has(effect)) return null;
    const ref = lookupPackImage(client, effect);
    return { id: effect, name: ref?.name ?? null, packName: ref?.packName ?? null };
  }, [client, effect, customEffectsMap]);

  const getDecorationLabel = (id: string | null) => {
    if (!id) return t('profile.decoration.none');
    if (orphanDecoration && id === orphanDecoration.id) {
      return orphanDecoration.name ?? t('profile.cosmetics.unsubscribedPackItem');
    }
    const labelKey = DECORATION_LABEL_KEYS[id];
    if (labelKey) return t(labelKey);
    const custom = customDecorationsMap.get(id);
    if (custom) return custom.name;
    if (id.startsWith('mxc://')) return t('profile.cosmetics.customDecoration');
    return id;
  };

  const getEffectLabel = (id: string | null) => {
    if (!id) return t('profile.effect.none');
    const labelKey = BUILTIN_EFFECT_LABELS[id];
    if (labelKey) return t(labelKey);
    const custom = customEffectsMap.get(id);
    if (custom) return custom.name;
    if (orphanEffect && id === orphanEffect.id) {
      return orphanEffect.name ?? t('profile.cosmetics.unsubscribedPackItem');
    }
    if (id.startsWith('mxc://')) return t('profile.cosmetics.customEffect');
    return id;
  };

  const filteredDecorations = useMemo(() => {
    const query = decorationSearch.trim().toLowerCase();
    const result: (string | null)[] = [null]; // "None" option first
    if (orphanDecoration) result.push(orphanDecoration.id);

    // 1. Pack / custom decorations
    for (const group of decorationPacks) {
      if (decorationCategory !== 'all' && decorationCategory !== `pack:${group.category}`) {
        continue;
      }
      for (const item of group.decorations) {
        if (
          !query ||
          item.name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.shortcode.toLowerCase().includes(query)
        ) {
          result.push(item.id);
        }
      }
    }

    // 2. Built-in decorations
    if (decorationCategory === 'all' || decorationCategory === 'builtin') {
      for (const id of BUILTIN_DECORATION_IDS) {
        const labelKey = DECORATION_LABEL_KEYS[id];
        const label = labelKey ? t(labelKey) : id;
        if (!query || label.toLowerCase().includes(query) || id.toLowerCase().includes(query)) {
          result.push(id);
        }
      }
    }

    return result;
  }, [decorationCategory, decorationSearch, decorationPacks, orphanDecoration, t]);

  const filteredEffects = useMemo(() => {
    const query = effectSearch.trim().toLowerCase();
    const result: (string | null)[] = [null]; // "None" option first
    if (orphanEffect) result.push(orphanEffect.id);

    // 1. Pack / custom effects
    for (const group of effectPacks) {
      if (effectCategory !== 'all' && effectCategory !== `pack:${group.category}`) {
        continue;
      }
      for (const item of group.effects) {
        if (
          !query ||
          item.name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.shortcode.toLowerCase().includes(query)
        ) {
          result.push(item.id);
        }
      }
    }

    // 2. Built-in particles
    if (effectCategory === 'all' || effectCategory === 'builtin') {
      for (const id of BUILTIN_PROFILE_EFFECT_IDS) {
        const labelKey = BUILTIN_EFFECT_LABELS[id];
        const label = labelKey ? t(labelKey) : id;
        if (!query || label.toLowerCase().includes(query) || id.toLowerCase().includes(query)) {
          result.push(id);
        }
      }
    }

    return result;
  }, [effectCategory, effectSearch, effectPacks, orphanEffect, t]);

  useEffect(() => {
    if (!fields) return;
    setAccent(fields.accent ?? '');
    setDecoration(fields.avatarDecoration);
    setEffect(fields.profileEffect);
  }, [fields]);

  if (!client) return null;

  const disabled = !supported || supportLoading;
  const accentHex = normalizeHex(accent);
  const accentInvalid = accent.trim() !== '' && !accentHex;
  const accentChanged = !!fields && !accentInvalid && accentHex !== fields.accent;
  const decorationChanged = !!fields && decoration !== fields.avatarDecoration;
  const effectChanged = !!fields && effect !== fields.profileEffect;
  const dirty = accentChanged || decorationChanged || effectChanged;

  const handleReset = () => {
    if (!fields) return;
    setAccent(fields.accent ?? '');
    setDecoration(fields.avatarDecoration);
    setEffect(fields.profileEffect);
  };

  const handleSave = async () => {
    try {
      await saveFields({
        accent: accentChanged ? accentHex : undefined,
        avatarDecoration: decorationChanged ? decoration : undefined,
        profileEffect: effectChanged ? effect : undefined,
      });
      toast.success(t('settings.account.profileSaved'));
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    }
  };

  const handleUploadDecoration = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    const allowed = ['image/png', 'image/gif', 'image/webp', 'image/apng'];
    if (!allowed.includes(file.type)) {
      toast.error(t('profile.cosmetics.unsupportedFormat'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('profile.cosmetics.sizeLimit', { mb: 10 }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploadingDeco(true);
    try {
      const res = await uploadUserDecoration(client, file);
      setDecoration(res.url);
      toast.success(t('profile.cosmetics.uploadedDecoration', { name: res.name }));
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    } finally {
      setUploadingDeco(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteCustomDecoration = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client) return;
    try {
      await deleteUserDecoration(client, id);
      if (decoration === id) {
        setDecoration(null);
      }
      toast.success(t('profile.cosmetics.decorationDeleted'));
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    }
  };

  const handleUploadEffect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    const allowed = ['image/png', 'image/gif', 'image/webp', 'image/apng'];
    if (!allowed.includes(file.type)) {
      toast.error(t('profile.cosmetics.unsupportedFormat'));
      if (effectFileInputRef.current) effectFileInputRef.current.value = '';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error(t('profile.cosmetics.sizeLimit', { mb: 15 }));
      if (effectFileInputRef.current) effectFileInputRef.current.value = '';
      return;
    }
    setUploadingEffect(true);
    try {
      const res = await uploadUserEffect(client, file);
      setEffect(res.url);
      toast.success(t('profile.cosmetics.uploadedEffect', { name: res.name }));
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    } finally {
      setUploadingEffect(false);
      if (effectFileInputRef.current) effectFileInputRef.current.value = '';
    }
  };

  const handleDeleteCustomEffect = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client) return;
    try {
      await deleteUserEffect(client, id);
      if (effect === id) {
        setEffect(null);
      }
      toast.success(t('profile.cosmetics.effectDeleted'));
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    }
  };

  const handleSaveFavoritePacks = async (favorites: RoomPackSummary[]) => {
    if (!client) return;
    try {
      await saveFavoritePacks(client, favorites);
      toast.success(t('profile.cosmetics.packsUpdated'));
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    }
  };

  const ownAvatarMxc = ownProfile?.avatarUrl ?? null;
  const displayName =
    ownProfile?.displayName || (myId ? myId.split(':')[0].replace('@', '') : 'User');
  const localpart = myId ? myId.split(':')[0].replace('@', '') : 'user';

  const currentDecorationMeta = decoration ? customDecorationsMap.get(decoration) : null;
  const currentEffectMeta = effect ? customEffectsMap.get(effect) : null;

  return (
    <div className={css.group}>
      <h4 className={css.groupTitle}>
        {t('profile.cosmetics.title')}
        <span className={css.mudrixBadge}>{t('profile.cosmetics.mudrixOnly')}</span>
      </h4>
      <p className={css.note}>{t('profile.cosmetics.note')}</p>

      <div className={css.customizerLayout}>
        {/* Left Column: Customization Controls */}
        <div className={css.editorCol}>
          {/* Avatar Decoration Section */}
          <Field label={t('profile.decoration.title')}>
            <div className={css.cosmeticCard}>
              <div className={css.cosmeticHeader}>
                <div className={css.cosmeticThumbCircle}>
                  <DecoratedAvatar decoration={decoration} client={client}>
                    <Avatar
                      name={displayName}
                      mxcUrl={ownAvatarMxc}
                      client={client}
                      size="sm"
                      placeholder="logo"
                    />
                  </DecoratedAvatar>
                </div>
                <div className={css.cosmeticDetails}>
                  <span className={css.cosmeticName}>{getDecorationLabel(decoration)}</span>
                  <span className={css.cosmeticMeta}>
                    {currentDecorationMeta?.category ??
                      (decoration
                        ? t('profile.cosmetics.builtin')
                        : t('profile.cosmetics.noneSelected'))}
                  </span>
                </div>
              </div>
              <div className={css.cosmeticActions}>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => setDecorationModalOpen(true)}
                >
                  <UserCircleIcon size={16} className={settingsCss.iconBefore} />
                  {t('profile.decoration.changeDecoration')}
                </Button>
                {decoration && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => setDecoration(null)}
                  >
                    {t('common.remove')}
                  </Button>
                )}
              </div>
            </div>
          </Field>

          {/* Profile Effect Section */}
          <Field label={t('profile.effect.title')}>
            <div className={css.cosmeticCard}>
              <div className={css.cosmeticHeader}>
                <div className={css.cosmeticThumbSquare}>
                  <EffectCosmeticThumb effect={effect} client={client} />
                </div>
                <div className={css.cosmeticDetails}>
                  <span className={css.cosmeticName}>{getEffectLabel(effect)}</span>
                  <span className={css.cosmeticMeta}>
                    {currentEffectMeta?.category ??
                      (effect
                        ? t('profile.cosmetics.builtinParticle')
                        : t('profile.cosmetics.noneSelected'))}
                  </span>
                </div>
              </div>
              <div className={css.cosmeticActions}>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => setEffectModalOpen(true)}
                >
                  <SparkleIcon size={16} className={settingsCss.iconBefore} />
                  {t('profile.effect.changeEffect')}
                </Button>
                {effect && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => setEffect(null)}
                  >
                    {t('common.remove')}
                  </Button>
                )}
              </div>
            </div>
          </Field>

          {/* Status Section */}
          <Field label={t('profile.status.title')} hint={t('profile.status.settingsHint')}>
            <div className={css.statusRow}>
              {status && (status.emoji || status.text) ? (
                <StatusPill status={status} />
              ) : (
                <span className={css.note}>{t('profile.status.none')}</span>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={() => setStatusOpen(true)}
              >
                <SmileyIcon size={14} className={settingsCss.iconBefore} />
                {status ? t('profile.status.edit') : t('profile.status.set')}
              </Button>
            </div>
          </Field>
          <CustomStatusModal open={statusOpen} onClose={() => setStatusOpen(false)} />

          {/* Accent Color Section */}
          <Field
            label={t('profile.accent.title')}
            hint={t('profile.accent.hint')}
            error={accentInvalid ? t('profile.accent.invalid') : undefined}
          >
            <div className={css.swatches}>
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={css.swatch}
                  style={{ backgroundColor: preset }}
                  aria-pressed={accentHex === preset}
                  aria-label={preset}
                  disabled={disabled}
                  onClick={() => setAccent(preset)}
                />
              ))}
            </div>
            <div className={css.colorInputRow}>
              <input
                type="color"
                className={css.colorInput}
                value={accentHex ?? DEFAULT_PICKER_COLOR}
                onChange={(e) => setAccent(e.target.value)}
                disabled={disabled}
                aria-label={t('profile.accent.title')}
              />
              <Input
                className={css.hexInput}
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                placeholder="#5865f2"
                maxLength={7}
                spellCheck={false}
                disabled={disabled}
                aria-label={t('profile.accent.hex')}
              />
              {accentHex && (
                <span
                  className={css.accentPreview}
                  style={{ backgroundColor: accentHex, color: readableTextColor(accentHex) }}
                >
                  {t('profile.accent.preview')}
                </span>
              )}
              {accent !== '' && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => setAccent('')}
                >
                  {t('profile.accent.reset')}
                </Button>
              )}
            </div>
          </Field>

          {/* Badge: automatic, not a picker - see useEnsureMudrixUserFlag */}
          <Field label={t('profile.badges.title')} hint={t('profile.badges.mudrixUserHint')}>
            <MudrixUserBadge />
          </Field>
        </div>

        {/* Right Column: Live Interactive Profile Preview Window */}
        <div className={css.previewCol}>
          <h4 className={css.previewHeading}>{t('profile.cosmetics.preview')}</h4>
          <div
            className={css.previewCard}
            style={
              {
                ...(accentHex
                  ? {
                      '--card-accent': accentHex,
                      borderColor: `color-mix(in srgb, var(--card-accent) 70%, ${vars.color.border})`,
                    }
                  : {}),
              } as React.CSSProperties
            }
          >
            {/* Banner */}
            <div className={css.previewBannerWrap}>
              {bannerSrc ? (
                <img src={bannerSrc} alt="" className={css.previewBanner} />
              ) : (
                <div
                  className={css.previewBannerFallback}
                  style={{ background: accentHex ? accentGradient(accentHex) : '#5865f2' }}
                />
              )}
              {accentHex && <div className={cardCss.coverTint} />}
            </div>

            {/* Avatar with selected decoration */}
            <div className={css.previewAvatarRow}>
              <DecoratedAvatar decoration={decoration} client={client}>
                <div className={css.previewAvatarWrap}>
                  <Avatar
                    name={displayName}
                    mxcUrl={ownAvatarMxc}
                    client={client}
                    size="xl"
                    placeholder="logo"
                  />
                </div>
              </DecoratedAvatar>
            </div>

            {/* Inset Body */}
            <div className={css.previewBody}>
              <span className={css.previewDisplayName}>{displayName}</span>
              <span className={css.previewUserId}>@{localpart}</span>
              {fields && fields.pronouns && fields.pronouns.length > 0 && (
                <span className={css.previewPronouns}>{formatPronouns(fields.pronouns)}</span>
              )}
              {status && (status.emoji || status.text) && (
                <div style={{ marginTop: '6px', marginBottom: '2px' }}>
                  <StatusPill status={status} />
                </div>
              )}
              {fields?.isMudrixUser && (
                <div style={{ marginTop: '4px' }}>
                  <MudrixUserBadge />
                </div>
              )}

              <div className={css.previewDivider} />

              <span className={css.previewSectionHeader}>{t('profile.cosmetics.aboutMe')}</span>
              <span className={css.previewBio}>
                {fields?.bio || t('profile.cosmetics.bioPlaceholder')}
              </span>
            </div>

            {/* Selected Profile Effect active animation */}
            {effect && <ProfileEffect effect={effect} />}
          </div>
        </div>
      </div>

      {/* Floating Save Notice Bar */}
      {dirty && (
        <div className={css.floatingSaveBar}>
          <span className={css.floatingSaveText}>{t('profile.cosmetics.unsavedChanges')}</span>
          <div className={css.floatingSaveActions}>
            <Button variant="secondary" size="sm" disabled={disabled || busy} onClick={handleReset}>
              <ArrowCounterClockwiseIcon size={14} className={settingsCss.iconBefore} />
              {t('profile.cosmetics.resetChanges')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={disabled || accentInvalid}
              loading={busy}
              onClick={handleSave}
            >
              {t('profile.cosmetics.saveChanges')}
            </Button>
          </div>
        </div>
      )}

      {/* Avatar Decoration Chooser Modal */}
      <Modal
        open={decorationModalOpen}
        onClose={() => setDecorationModalOpen(false)}
        title={t('profile.decoration.chooseTitle')}
        titleIcon={<UserCircleIcon size={20} />}
        size="lg"
        footer={
          <Button variant="primary" onClick={() => setDecorationModalOpen(false)}>
            {t('common.done')}
          </Button>
        }
      >
        <div className={css.modalFilterRow}>
          <div className={css.modalSearch}>
            <Input
              placeholder={t('profile.decoration.searchPlaceholder')}
              value={decorationSearch}
              onChange={(e) => setDecorationSearch(e.target.value)}
            />
          </div>
          <div className={css.modalCategorySelect}>
            <Select
              value={decorationCategory}
              onChange={setDecorationCategory}
              options={decorationCategories}
            />
          </div>
          <span className={css.modalCount}>
            {t('profile.cosmetics.decorationsCount', { count: filteredDecorations.length - 1 })}
          </span>
        </div>

        <div className={css.modalActionsRow}>
          <div className={css.modalButtons}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUploadDecoration}
              accept="image/png,image/gif,image/webp,image/apng"
              style={{ display: 'none' }}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={uploadingDeco}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadSimpleIcon size={16} className={settingsCss.iconBefore} />
              {t('profile.decoration.uploadDecoration')}
            </Button>
            <FavoritePacksSelect
              client={client}
              current={favoritePacks}
              onSave={handleSaveFavoritePacks}
              kind="decoration"
            />
          </div>
        </div>
        {orphanDecoration && <p className={css.note}>{t('profile.cosmetics.unsubscribedNote')}</p>}

        <div className={css.modalScrollArea}>
          <div className={css.decorationGrid}>
            {filteredDecorations.map((id) => {
              const label = getDecorationLabel(id);
              const isSelected = decoration === id;
              const customMeta = id ? customDecorationsMap.get(id) : null;
              const isCustomUpload = customMeta?.isCustom;

              return (
                <DecorationOptionItem
                  key={id ?? 'none'}
                  id={id}
                  label={label}
                  isSelected={isSelected}
                  isCustomUpload={isCustomUpload}
                  hint={
                    orphanDecoration && id === orphanDecoration.id
                      ? t('profile.cosmetics.unsubscribedHint', {
                          pack: orphanDecoration.packName ?? '',
                        })
                      : undefined
                  }
                  client={client}
                  onSelect={() => setDecoration(id)}
                  onDelete={
                    isCustomUpload && id ? (e) => handleDeleteCustomDecoration(id, e) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Profile Effect Chooser Modal */}
      <Modal
        open={effectModalOpen}
        onClose={() => setEffectModalOpen(false)}
        title={t('profile.effect.chooseTitle')}
        titleIcon={<SparkleIcon size={20} />}
        size="lg"
        footer={
          <Button variant="primary" onClick={() => setEffectModalOpen(false)}>
            {t('common.done')}
          </Button>
        }
      >
        <div className={css.modalFilterRow}>
          <div className={css.modalSearch}>
            <Input
              placeholder={t('profile.effect.searchPlaceholder')}
              value={effectSearch}
              onChange={(e) => setEffectSearch(e.target.value)}
            />
          </div>
          <div className={css.modalCategorySelect}>
            <Select
              value={effectCategory}
              onChange={setEffectCategory}
              options={effectCategories}
            />
          </div>
          <span className={css.modalCount}>
            {t('profile.cosmetics.effectsCount', { count: filteredEffects.length - 1 })}
          </span>
        </div>

        <div className={css.modalActionsRow}>
          <div className={css.modalButtons}>
            <input
              type="file"
              ref={effectFileInputRef}
              onChange={handleUploadEffect}
              accept="image/png,image/gif,image/webp,image/apng"
              style={{ display: 'none' }}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={uploadingEffect}
              onClick={() => effectFileInputRef.current?.click()}
            >
              <UploadSimpleIcon size={16} className={settingsCss.iconBefore} />
              {t('profile.effect.uploadEffectOrBorder')}
            </Button>
            <FavoritePacksSelect
              client={client}
              current={favoritePacks}
              onSave={handleSaveFavoritePacks}
              kind="effect"
            />
          </div>
        </div>
        {orphanEffect && <p className={css.note}>{t('profile.cosmetics.unsubscribedNote')}</p>}

        <div className={css.modalScrollArea}>
          <div className={css.effectGrid}>
            {filteredEffects.map((id) => {
              const label = getEffectLabel(id);
              const isSelected = effect === id;
              const customMeta = id ? customEffectsMap.get(id) : null;
              const isCustomUpload = customMeta?.isCustom;
              const category =
                customMeta?.category ??
                (id ? t('profile.cosmetics.builtinParticle') : t('profile.effect.none'));

              return (
                <EffectOptionItem
                  key={id ?? 'none'}
                  id={id}
                  label={label}
                  category={category}
                  isSelected={isSelected}
                  isCustomUpload={isCustomUpload}
                  hint={
                    orphanEffect && id === orphanEffect.id
                      ? t('profile.cosmetics.unsubscribedHint', {
                          pack: orphanEffect.packName ?? '',
                        })
                      : undefined
                  }
                  client={client}
                  onSelect={() => setEffect(id)}
                  onDelete={
                    isCustomUpload && id ? (e) => handleDeleteCustomEffect(id, e) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
