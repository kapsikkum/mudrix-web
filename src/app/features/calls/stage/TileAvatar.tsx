import type { MatrixClient } from 'matrix-js-sdk';
import { useMediaBlobUrl } from '@/app/components/Avatar/useMediaBlobUrl';
import { getInitialAndHue } from '@/app/components/Avatar/avatarHue';
import { useExtendedProfile } from '@/app/hooks/useExtendedProfile';
import { useDecorationSrc } from '@/app/features/profile/ProfileCosmetics';
import { useStaticDecorationSrc } from '@/app/features/profile/ListCosmetics';
import { MUD_MOUND_FACETS, MUD_MOUND_VIEWBOX } from '@/theme/mudMoundGeometry';
import * as css from './CallStage.css';

// Animated pictures and decorations show a still frame and only play while that person speaks.

const TONE_OPACITY = [0.55, 0.65, 0.75, 0.85, 0.92, 1];
/** Big enough for the largest tile avatar at 2x. */
const STILL_SIZE = 256;

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

interface Props {
  client: MatrixClient;
  userId: string;
  name: string;
  mxc: string | null;
  speaking: boolean;
}

/** The centred avatar of a person tile with no camera: their picture and decoration. */
export function TileAvatar({ client, userId, name, mxc, speaking }: Props) {
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

  return (
    <div className={css.avatarLayer} aria-hidden="true">
      <div className={css.avatarWrap}>
        <div
          className={speaking ? css.avatarCircleSpeaking : css.avatarCircle}
          style={{ backgroundColor: `hsl(${hue}, 60%, 42%)` }}
        >
          {stillAvatar ? (
            <StillOrAnimated
              className={css.avatarImg}
              still={stillAvatar}
              animated={animatedAvatar}
              playing={speaking}
            />
          ) : (
            <svg className={css.avatarMark} viewBox={MUD_MOUND_VIEWBOX}>
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
            className={css.avatarDecoration}
            still={stillDecoration}
            animated={animatedDecoration}
            playing={speaking}
          />
        )}
      </div>
    </div>
  );
}
