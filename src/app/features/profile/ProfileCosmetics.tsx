import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import { showHomeserverSoftwareAtom } from '@/app/store/atoms';
import { publicUrl } from '@/util/publicUrl';
import { useEffect, useState } from 'react';
import { HardDrivesIcon, SealCheckIcon } from '@phosphor-icons/react';
import type { ComponentType } from 'react';
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
import { builtinNameplateSrc, getBuiltinNameplate } from '@/util/builtinCosmetics';
import { useNameplatePacks } from '@/app/hooks/useUserPacks';
import {
  describeSoftware,
  getHomeserverSoftware,
  type HomeserverSoftware,
} from '@/util/homeserverSoftware';
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
  'claude-buddy': 'profile.decoration.claudeBuddy',
  headphones: 'profile.decoration.headphones',
  'rain-cloud': 'profile.decoration.rainCloud',
  butterflies: 'profile.decoration.butterflies',
  'orbiting-planets': 'profile.decoration.orbitingPlanets',
  'mud-splat': 'profile.decoration.mudSplat',
  'grasping-hands': 'profile.decoration.graspingHands',
};

/**
 * The one real badge: set automatically (never user-picked) by any Mudrix client the account
 * has signed into, via useEnsureMudrixUserFlag. Replaces the old self-selected badge picker.
 */
export function MudrixBadgeIcon() {
  const { t } = useTranslation();
  const label = t('profile.badge.mudrixUser');
  return (
    <Tooltip content={label}>
      <span className={css.badge} role="img" aria-label={label}>
        <SealCheckIcon size={14} color="#4ade80" weight="fill" />
      </span>
    </Tooltip>
  );
}

function HomeserverBadgeIcon({ software }: { software: HomeserverSoftware }) {
  const known = describeSoftware(software.name);
  const label = software.version ? `${known.label} ${software.version}` : known.label;
  return (
    <Tooltip content={label}>
      <span
        className={css.badge}
        role="img"
        aria-label={label}
        style={
          known.logo || known.emoji
            ? { fontSize: 13, lineHeight: 1 }
            : {
                color: known.color,
                borderColor: `color-mix(in srgb, ${known.color} 55%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${known.color} 18%, transparent)`,
                fontSize: known.glyph.length > 1 ? 9 : 11,
                fontWeight: 800,
                lineHeight: 1,
              }
        }
      >
        {known.logo ? (
          <img
            src={publicUrl(`assets/homeservers/${known.logo}`)}
            alt=""
            width={16}
            height={16}
            draggable={false}
            style={{ objectFit: 'contain' }}
          />
        ) : (
          (known.emoji ?? known.glyph)
        )}
      </span>
    </Tooltip>
  );
}

/** The homeserver badge as a settings preview (the real one shows the software in use). */
export function HomeserverBadgePreview() {
  return (
    <span className={css.badge} aria-hidden>
      <HardDrivesIcon size={14} color="#38bdf8" weight="fill" />
    </span>
  );
}

/**
 * Every badge a profile card can show, for the Badges settings. A badge with an `atom` can be
 * switched off with it; one without is automatic. Add a badge here (plus its strings) and it
 * appears in the settings, and `ProfileBadges` below is where it is drawn.
 */
export interface BadgeDefinition {
  id: string;
  /** i18n keys of its name and its description. */
  labelKey: string;
  hintKey: string;
  Icon: ComponentType;
  /** The preference that shows or hides it; absent when it is automatic. */
  atom?: typeof showHomeserverSoftwareAtom;
}

export const PROFILE_BADGES: readonly BadgeDefinition[] = [
  {
    id: 'mudrix',
    labelKey: 'profile.badge.mudrixUser',
    hintKey: 'profile.badges.mudrixUserHint',
    Icon: MudrixBadgeIcon,
  },
  {
    id: 'homeserver',
    labelKey: 'profile.badges.homeserver',
    hintKey: 'profile.badges.showHomeserverHint',
    Icon: HomeserverBadgePreview,
    atom: showHomeserverSoftwareAtom,
  },
];

/** The Mudrix-user badge on its own (settings field). */
export function MudrixUserBadge() {
  return (
    <div className={css.badgeRow}>
      <MudrixBadgeIcon />
    </div>
  );
}

/**
 * The badges on a profile card: the automatic Mudrix-user badge, and the homeserver software of
 * the account (asked of the server directly, hover for name and version). `floating` pins the
 * row to the top-right of the nearest positioned ancestor (the card's name block).
 */
export function ProfileBadges({
  userId,
  showMudrix,
  floating = false,
  style,
}: {
  userId: string;
  showMudrix: boolean;
  floating?: boolean;
  style?: React.CSSProperties;
}) {
  const showSoftware = useAtomValue(showHomeserverSoftwareAtom);
  const serverName = userId.split(':').slice(1).join(':');
  const [software, setSoftware] = useState<HomeserverSoftware | null>(null);

  useEffect(() => {
    setSoftware(null);
    if (!serverName || !showSoftware) return undefined;
    let cancelled = false;
    getHomeserverSoftware(serverName).then((found) => {
      if (!cancelled) setSoftware(found);
    });
    return () => {
      cancelled = true;
    };
  }, [serverName, showSoftware]);

  if (!showMudrix && !software) return null;
  return (
    <div className={floating ? `${css.badgeRow} ${css.badgeFloating}` : css.badgeRow} style={style}>
      {showMudrix && <MudrixBadgeIcon />}
      {software && <HomeserverBadgeIcon software={software} />}
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
  const builtin = isMxc ? undefined : getBuiltinNameplate(url);

  const { src: blobUrl } = useMediaBlobUrl(c, isMxc ? url : null, {
    width: options.thumb,
    height: options.thumb,
    enabled: options.enabled,
    queue: true,
  });

  // Only mxc:// media or a known built-in id is ever loaded (a profile or pack must not make
  // clients fetch other hosts).
  if (builtin) return builtinNameplateSrc(builtin);
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
    const builtin = getBuiltinNameplate(nameplate);
    if (builtin) return { url: builtin.id, palette: builtin.palette };
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
