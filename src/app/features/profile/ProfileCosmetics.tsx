import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { SealCheckIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { Tooltip } from '@/app/components/Tooltip';
import { getMatrixClientOrNull } from '@/client/clientHolder';
import { useMediaBlobUrl } from '@/app/components/Avatar/useMediaBlobUrl';
import {
  avatarDecorationSrc,
  profileEffectThumbnailSrc,
  nameplatePaletteRgb,
  type AvatarDecorationId,
  type ProfileEffectId,
  type NameplateId,
  type ProfileStatus,
} from '@/util/profileCosmetics';
import { useNameplatePacks } from '@/app/hooks/useUserPacks';
import * as css from './ProfileCard.css';

export const DECORATION_LABEL_KEYS: Record<string, string> = {
  ring: 'profile.decoration.ring',
  thorns: 'profile.decoration.thorns',
  sparkle: 'profile.decoration.sparkle',
  flame: 'profile.decoration.flame',
  'pixel-hearts': 'profile.decoration.pixelHearts',
  stars: 'profile.decoration.stars',
  halo: 'profile.decoration.halo',
  'cat-ears': 'profile.decoration.catEars',
  'bunny-ears': 'profile.decoration.bunnyEars',
  crown: 'profile.decoration.crown',
  'leaf-wreath': 'profile.decoration.leafWreath',
  'neon-ring': 'profile.decoration.neonRing',
  'glitch-ring': 'profile.decoration.glitchRing',
  'snowflake-ring': 'profile.decoration.snowflakeRing',
  'cherry-blossoms': 'profile.decoration.cherryBlossoms',
  'angel-wings': 'profile.decoration.angelWings',
  'devil-horns': 'profile.decoration.devilHorns',
};

/**
 * The one real badge: set automatically (never user-picked) by any Mudrix client the account
 * has signed into, via useEnsureMudrixUserFlag. Replaces the old self-selected badge picker.
 */
export function MudrixUserBadge({
  floating = false,
  style,
}: {
  /** Pin to the top-right of the nearest positioned ancestor (the card's name block). */
  floating?: boolean;
  style?: React.CSSProperties;
}) {
  const { t } = useTranslation();
  const label = t('profile.badge.mudrixUser');
  return (
    <div className={floating ? `${css.badgeRow} ${css.badgeFloating}` : css.badgeRow} style={style}>
      <Tooltip content={label}>
        <span className={css.badge} role="img" aria-label={label}>
          <SealCheckIcon size={14} color="#4ade80" weight="fill" />
        </span>
      </Tooltip>
    </div>
  );
}

/**
 * Options for the cosmetic image hooks. `thumb` requests a small still thumbnail from the
 * homeserver instead of the full (often large, animated) media; use it for grids. `enabled` lets
 * a grid tile fetch only while visible.
 */
export interface CosmeticSrcOptions {
  thumb?: number;
  enabled?: boolean;
}

/** Resolves a decoration to an image source. For Matrix mxc:// media, fetches via authenticated blob URL so GIFs/APNGs animate and bypass 401s. */
export function useDecorationSrc(
  decoration: AvatarDecorationId | null | undefined,
  client?: MatrixClient | null,
  options: CosmeticSrcOptions = {}
): string | undefined {
  const c = client ?? getMatrixClientOrNull();
  const isMxc = !!decoration && decoration.startsWith('mxc://');

  const { src: blobUrl } = useMediaBlobUrl(c, isMxc ? decoration : null, {
    width: options.thumb,
    height: options.thumb,
    enabled: options.enabled,
    queue: true,
  });

  if (!decoration) return undefined;
  if (isMxc) return blobUrl;
  return avatarDecorationSrc(decoration);
}

/** Resolves a profile effect thumbnail or preview source with authenticated blob support for mxc://. */
export function useEffectSrc(
  effect: ProfileEffectId | null | undefined,
  client?: MatrixClient | null,
  options: CosmeticSrcOptions = {}
): string | undefined {
  const c = client ?? getMatrixClientOrNull();
  const isMxc = !!effect && effect.startsWith('mxc://');

  const { src: blobUrl } = useMediaBlobUrl(c, isMxc ? effect : null, {
    width: options.thumb,
    height: options.thumb,
    enabled: options.enabled,
    queue: true,
  });

  if (!effect) return undefined;
  if (isMxc) return blobUrl;
  return profileEffectThumbnailSrc(effect, c);
}

/**
 * Gives every mount its own copy of the image so an animated APNG/GIF starts from its first frame
 * again. Browsers share one decoded animation per URL, so reopening a card would otherwise resume
 * mid-loop (or sit on the last frame) instead of replaying.
 */
function useRestartingSrc(src: string | undefined): string | undefined {
  const [fresh, setFresh] = useState<{ from: string; url: string } | null>(null);

  useEffect(() => {
    if (!src || !src.startsWith('blob:')) return undefined;
    let cancelled = false;
    let created: string | undefined;
    fetch(src)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setFresh({ from: src, url: created });
      })
      .catch(() => {
        // fall back to the shared copy
        if (!cancelled) setFresh({ from: src, url: src });
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src]);

  if (!src) return undefined;
  if (!src.startsWith('blob:')) return src;
  // Nothing until the private copy exists, so the shared (mid-loop) animation is never shown.
  return fresh?.from === src ? fresh.url : undefined;
}

/** Wraps an avatar and draws an avatar decoration frame around it. */
export function DecoratedAvatar({
  decoration,
  children,
  client,
}: {
  decoration: AvatarDecorationId | null;
  children: React.ReactNode;
  client?: MatrixClient | null;
}) {
  const src = useRestartingSrc(useDecorationSrc(decoration, client));
  if (!decoration) return <>{children}</>;
  return (
    <span className={css.decorated} style={{ display: 'inline-flex' }}>
      {children}
      {src && (
        <img
          className={css.decoration}
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      )}
    </span>
  );
}

/** "🎮 Playing something" pill. */
export function StatusPill({ status }: { status: ProfileStatus }) {
  if (!status.emoji && !status.text) return null;
  return (
    <span className={css.statusPill}>
      {status.emoji && <span className={css.statusEmoji}>{status.emoji}</span>}
      {status.text && <span className={css.statusText}>{status.text}</span>}
    </span>
  );
}

/** Resolves a nameplate image source with authenticated blob support for mxc://. */
export function useNameplateSrc(
  nameplate: NameplateId | null | undefined,
  client?: MatrixClient | null,
  options: CosmeticSrcOptions = {}
): string | undefined {
  const c = client ?? getMatrixClientOrNull();
  const url =
    typeof nameplate === 'object' && nameplate !== null ? nameplate.url : (nameplate ?? null);
  const isMxc = !!url && url.startsWith('mxc://');

  const { src: blobUrl } = useMediaBlobUrl(c, isMxc ? url : null, {
    width: options.thumb,
    height: options.thumb,
    enabled: options.enabled,
    queue: true,
  });

  // Only mxc:// media is ever loaded (a profile or pack must not make clients fetch other hosts).
  return isMxc ? blobUrl : undefined;
}

/** Resolves a stored nameplate (object, mxc string or pack id) to its image source and palette. */
export function useResolvedNameplate(
  nameplate: NameplateId | null | undefined,
  client?: MatrixClient | null
): { src: string | undefined; palette?: string; active: boolean } {
  const c = client ?? getMatrixClientOrNull();
  const packs = useNameplatePacks(c);

  const { url, palette } = ((): { url: string | null; palette?: string } => {
    if (!nameplate) return { url: null, palette: undefined };
    if (typeof nameplate === 'object' && nameplate !== null) {
      return { url: nameplate.url, palette: nameplate.palette };
    }
    // String mxc - check packs for palette metadata
    for (const group of packs) {
      for (const item of group.nameplates) {
        if (item.id === nameplate || item.url === nameplate) {
          return { url: item.url, palette: item.palette };
        }
      }
    }
    return { url: nameplate, palette: undefined };
  })();

  const src = useNameplateSrc(url, c);
  return { src, palette, active: !!url };
}

export function NameplateWrapper({
  nameplate,
  children,
  client,
  className,
  style,
}: {
  nameplate: NameplateId | null | undefined;
  children: React.ReactNode;
  client?: MatrixClient | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { src: rawSrc, palette, active } = useResolvedNameplate(nameplate, client);
  const src = useRestartingSrc(rawSrc);

  if (!active) return <>{children}</>;

  const rgb = nameplatePaletteRgb(palette);

  return (
    <span
      className={[css.nameplateWrapper, className].filter(Boolean).join(' ')}
      style={
        {
          background: `linear-gradient(90deg, rgba(${rgb}, 0.2) 0%, rgba(${rgb}, 0.55) 100%), rgba(0, 0, 0, 0.25)`,
          ...style,
        } as React.CSSProperties
      }
    >
      {src && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className={css.nameplateBg}
          draggable={false}
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      )}
      <span className={css.nameplateContent}>{children}</span>
    </span>
  );
}
