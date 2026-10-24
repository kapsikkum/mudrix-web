import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { elementCallEmbedAtom } from '@/app/store/atoms/elementCall';
import { useMediaBlobUrl } from '@/app/components/Avatar/useMediaBlobUrl';
import { getInitialAndHue } from '@/app/components/Avatar/avatarHue';
import { useExtendedProfile } from '@/app/hooks/useExtendedProfile';
import { useDecorationSrc } from '@/app/features/profile/ProfileCosmetics';
import { useStaticDecorationSrc } from '@/app/features/profile/ListCosmetics';
import { getTileVm } from '@/app/plugins/call/elementCallTiles';
import { MUD_MOUND_FACETS, MUD_MOUND_VIEWBOX } from '@/theme/mudMoundGeometry';

// Element Call draws its avatars from its own data: no decorations, and an initial letter when
// there is no picture. We draw Mudrix's avatar over each person tile instead. Our stylesheet does
// not reach inside the call iframe, so the look lives in buildCallGridStyles (`mx-tile-avatar*`),
// which also hides EC's avatar and turns on the speaking glow.
//
// Animated pictures and decorations show a still frame and only play while that person speaks.

/** Person tiles laid out by CallGridLayout (`data-mx-tile`, no `data-mx-screen`). */
const PERSON_TILE = '[data-mx-tile]:not([data-mx-screen])';
const ATTR_AVATAR = 'data-mx-avatar';
const ATTR_SPEAKING = 'data-mx-speaking';
const TONE_OPACITY = [0.55, 0.65, 0.75, 0.85, 0.92, 1];
/** Big enough for the largest tile avatar at 2x. */
const STILL_SIZE = 256;

const tileIds = new WeakMap<HTMLElement, number>();
let nextTileId = 0;
function tileKey({ el, userId }: { el: HTMLElement; userId: string }): string {
  let id = tileIds.get(el);
  if (id === undefined) {
    id = nextTileId++;
    tileIds.set(el, id);
  }
  return `${id}|${userId}`;
}

interface PersonTile {
  el: HTMLElement;
  userId: string;
}

function scanTiles(doc: Document): PersonTile[] {
  const tiles: PersonTile[] = [];
  doc.querySelectorAll<HTMLElement>(PERSON_TILE).forEach((el) => {
    const userId = getTileVm(el)?.userId;
    if (typeof userId === 'string') tiles.push({ el, userId });
  });
  return tiles;
}

function sameTiles(a: PersonTile[], b: PersonTile[]): boolean {
  return a.length === b.length && a.every((t, i) => t.el === b[i].el && t.userId === b[i].userId);
}

function useSpeaking(el: HTMLElement): boolean {
  const [speaking, setSpeaking] = useState(() => el.hasAttribute(ATTR_SPEAKING));
  useEffect(() => {
    const win = el.ownerDocument.defaultView;
    if (!win) return undefined;
    const update = () => setSpeaking(el.hasAttribute(ATTR_SPEAKING));
    const observer = new win.MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: [ATTR_SPEAKING] });
    update();
    return () => observer.disconnect();
  }, [el]);
  return speaking;
}

/** A still image normally, the animated original layered on top while `playing`. */
function StillOrAnimated({
  still,
  animated,
  playing,
  className,
}: {
  still: string | undefined;
  animated: string | undefined;
  playing: boolean;
  className: string;
}) {
  return (
    <>
      {still && <img className={className} src={still} alt="" draggable={false} />}
      {playing && animated && animated !== still && (
        <img className={className} src={animated} alt="" draggable={false} />
      )}
    </>
  );
}

function TileAvatar({ tile, client }: { tile: PersonTile; client: MatrixClient }) {
  const { el, userId } = tile;
  const speaking = useSpeaking(el);
  const embed = useAtomValue(elementCallEmbedAtom);
  const member = embed?.room.getMember(userId);
  const name = member?.name ?? client.getUser(userId)?.displayName ?? userId;
  const mxc = member?.getMxcAvatarUrl() ?? client.getUser(userId)?.avatarUrl ?? null;
  const { hue } = getInitialAndHue(name);

  // Thumbnails come back as still frames; the full download keeps a GIF's animation.
  const { src: stillAvatar } = useMediaBlobUrl(client, mxc, {
    width: STILL_SIZE,
    height: STILL_SIZE,
    resizeMethod: 'crop',
  });
  const { src: animatedAvatar } = useMediaBlobUrl(client, mxc, { enabled: speaking, queue: true });

  const { data: profile } = useExtendedProfile(client, userId);
  const decoration = profile?.avatarDecoration ?? null;
  const stillDecoration = useStaticDecorationSrc(decoration, client);
  const animatedDecoration = useDecorationSrc(decoration, client, { enabled: speaking });

  useEffect(() => {
    el.setAttribute(ATTR_AVATAR, '');
    return () => el.removeAttribute(ATTR_AVATAR);
  }, [el]);

  return createPortal(
    <div className="mx-tile-avatar-layer" aria-hidden="true">
      <div className="mx-tile-avatar-wrap">
        <div className="mx-tile-avatar" style={{ backgroundColor: `hsl(${hue}, 60%, 42%)` }}>
          {stillAvatar ? (
            <StillOrAnimated
              className="mx-tile-avatar-img"
              still={stillAvatar}
              animated={animatedAvatar}
              playing={speaking}
            />
          ) : (
            <svg className="mx-tile-avatar-mark" viewBox={MUD_MOUND_VIEWBOX}>
              <g fill="#fff">
                {MUD_MOUND_FACETS.map((facet, i) => (
                  <polygon key={i} points={facet.points} fillOpacity={TONE_OPACITY[facet.tone]} />
                ))}
              </g>
            </svg>
          )}
        </div>
        {decoration && (
          <StillOrAnimated
            className="mx-tile-avatar-decoration"
            still={stillDecoration}
            animated={animatedDecoration}
            playing={speaking}
          />
        )}
      </div>
    </div>,
    el
  );
}

export function CallTileAvatars({ client }: { client: MatrixClient }) {
  const embed = useAtomValue(elementCallEmbedAtom);
  const [tiles, setTiles] = useState<PersonTile[]>([]);

  useEffect(() => {
    const doc = embed?.document;
    const win = doc?.defaultView;
    if (!doc || !win) return undefined;
    let frame: number | null = null;
    const rescan = () => {
      if (frame !== null) return;
      frame = win.requestAnimationFrame(() => {
        frame = null;
        const next = scanTiles(doc);
        setTiles((prev) => (sameTiles(prev, next) ? prev : next));
      });
    };
    const observer = new win.MutationObserver(rescan);
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-mx-tile', 'data-mx-screen'],
    });
    rescan();
    return () => {
      observer.disconnect();
      if (frame !== null) win.cancelAnimationFrame(frame);
      setTiles([]);
    };
  }, [embed]);

  return (
    <>
      {tiles.map((tile) => (
        <TileAvatar key={tileKey(tile)} tile={tile} client={client} />
      ))}
    </>
  );
}
