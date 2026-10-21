import { useTranslation } from 'react-i18next';
import { SealCheckIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { Tooltip } from '@/app/components/Tooltip';
import { getMatrixClientOrNull } from '@/client/clientHolder';
import { useMediaBlobUrl } from '@/app/components/Avatar/useMediaBlobUrl';
import {
  avatarDecorationSrc,
  profileEffectThumbnailSrc,
  type AvatarDecorationId,
  type ProfileEffectId,
  type ProfileStatus,
} from '@/util/profileCosmetics';
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
export function MudrixUserBadge() {
  const { t } = useTranslation();
  const label = t('profile.badge.mudrixUser');
  return (
    <div className={css.badgeRow}>
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
  const src = useDecorationSrc(decoration, client);
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
