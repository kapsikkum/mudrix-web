import { useEffect, useState, type ReactNode } from 'react';
import { GifFavouriteButton } from './GifFavouriteButton';
import {
  hasGifConsent,
  parseGifLink,
  resolveGifLink,
  type GifItem,
} from '../composer/gifProviders';
import * as css from '../Timeline.css';

interface GifLinkEmbedProps {
  /** The message text; only a body that is nothing but one GIPHY / KLIPY link becomes a GIF. */
  body: string;
  /** Shown instead while resolving, when it isn't a GIF link, or when the GIF can't be loaded. */
  children: ReactNode;
}

/**
 * Shows a bare GIPHY / KLIPY link as the GIF itself. The GIF is fetched from the provider's CDN,
 * so this only happens once the user has agreed to contact the GIF providers (the same consent
 * the picker asks for); until then the link stays a link.
 */
export function GifLinkEmbed({ body, children }: GifLinkEmbedProps) {
  const link = parseGifLink(body);
  const linkKey = link ? JSON.stringify(link) : null;
  const [item, setItem] = useState<GifItem | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setItem(null);
    setFailed(false);
    if (!link || !hasGifConsent(link.provider)) return undefined;
    const ctrl = new AbortController();
    resolveGifLink(link, ctrl.signal)
      .then((resolved) => {
        if (ctrl.signal.aborted) return;
        if (resolved) setItem(resolved);
        else setFailed(true);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `link` is derived from linkKey
  }, [linkKey]);

  if (!item || failed) return <>{children}</>;
  return (
    <div className={css.gifLinkBox}>
      <img
        className={css.gifLinkImg}
        src={item.thumbUrl}
        alt={item.title || 'GIF'}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      <GifFavouriteButton item={item} />
    </div>
  );
}
