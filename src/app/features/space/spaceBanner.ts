import { useCallback, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { roomStateMaybe } from '@/util/matrix';

/** Matrix has no space banner, so Mudrix keeps one in a state event on the space. */
export const SPACE_BANNER_STATE_TYPE = 'chat.mudrix.space_banner';

export interface SpaceBanner {
  /** An uploaded image, as an mxc:// URL. */
  url?: string;
  /** One of SPACE_BANNER_PRESETS, used when there is no image. */
  color?: string;
}

export const SPACE_BANNER_PRESETS: { id: string; css: string }[] = [
  { id: 'pink', css: 'linear-gradient(135deg, #ff3d9a, #ff8cc6)' },
  { id: 'red', css: 'linear-gradient(135deg, #e5231f, #ff6a5c)' },
  { id: 'orange', css: 'linear-gradient(135deg, #e8741a, #ffb066)' },
  { id: 'yellow', css: 'linear-gradient(135deg, #e6b81f, #fff07a)' },
  { id: 'purple', css: 'linear-gradient(135deg, #6a2a96, #c37fe0)' },
  { id: 'blue', css: 'linear-gradient(135deg, #0a84ff, #66c8ff)' },
  { id: 'teal', css: 'linear-gradient(135deg, #2fc9ac, #a3fff0)' },
  { id: 'green', css: 'linear-gradient(135deg, #2f5d0a, #6aa82a)' },
  { id: 'graphite', css: 'linear-gradient(135deg, #1b1b1f, #4a4a52)' },
];

export function presetCss(id: string | undefined): string | undefined {
  return SPACE_BANNER_PRESETS.find((p) => p.id === id)?.css;
}

export function readSpaceBanner(client: MatrixClient, spaceId: string): SpaceBanner | null {
  const content = roomStateMaybe(client.getRoom(spaceId))
    ?.getStateEvents(SPACE_BANNER_STATE_TYPE, '')
    ?.getContent() as Record<string, unknown> | undefined;
  if (!content) return null;
  const url = typeof content['url'] === 'string' && content['url'] ? content['url'] : undefined;
  const color =
    typeof content['color'] === 'string' && presetCss(content['color'] as string)
      ? (content['color'] as string)
      : undefined;
  return url || color ? { url, color } : null;
}

export async function setSpaceBanner(
  client: MatrixClient,
  spaceId: string,
  banner: SpaceBanner | null
): Promise<void> {
  await client.sendStateEvent(
    spaceId,
    SPACE_BANNER_STATE_TYPE as never,
    {
      ...(banner?.url ? { url: banner.url } : {}),
      ...(banner?.color ? { color: banner.color } : {}),
    } as never,
    ''
  );
}

/** The space's banner, kept current as the state event changes. */
export function useSpaceBanner(
  client: MatrixClient | null | undefined,
  spaceId: string | null | undefined
): SpaceBanner | null {
  const read = useCallback(
    () => (client && spaceId ? readSpaceBanner(client, spaceId) : null),
    [client, spaceId]
  );
  const [banner, setBanner] = useState<SpaceBanner | null>(read);
  const [lastKey, setLastKey] = useState(`${spaceId}`);
  if (lastKey !== `${spaceId}`) {
    setLastKey(`${spaceId}`);
    setBanner(read());
  }
  useMatrixEvent(
    client ?? null,
    'RoomState.events',
    (event: { getType: () => string; getRoomId: () => string | undefined }) => {
      if (event.getType() === SPACE_BANNER_STATE_TYPE && event.getRoomId() === spaceId) {
        setBanner(read());
      }
    }
  );
  return banner;
}
