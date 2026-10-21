import { useState, useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useLinkPreview } from '@/app/hooks/useLinkPreview';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';
import { Tooltip } from '@/app/components/Tooltip';
import { parseYouTubeUrl } from '@/util/youtube';
import { YouTubeEmbed } from './YouTubeEmbed';
import * as css from './LinkPreview.css';

interface LinkPreviewProps {
  url: string;
  client: MatrixClient;
  isEncrypted: boolean;
}

function GenericLinkPreview({ url, client, isEncrypted }: LinkPreviewProps) {
  const { data, isLoading } = useLinkPreview(client, url, isEncrypted);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const ogImage = data?.['og:image'];

  useEffect(() => {
    if (!ogImage || imgError) {
      setImgSrc(null);
      return;
    }
    if (ogImage.startsWith('mxc://')) {
      // Authenticated media — must fetch with Bearer token, then use blob URL.
      let revoked = false;
      let currentBlobUrl: string | null = null;
      fetchMediaBlobUrl(ogImage, client, 1).then((blobUrl) => {
        if (!blobUrl) return;
        if (revoked) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        currentBlobUrl = blobUrl;
        setImgSrc(blobUrl);
      });
      return () => {
        revoked = true;
        const toRevoke = currentBlobUrl;
        if (toRevoke) URL.revokeObjectURL(toRevoke);
      };
    } else {
      // Direct https:// URL from the homeserver — usable in <img> directly.
      setImgSrc(ogImage);
    }
  }, [ogImage, client, imgError]);

  // Hold the card's space while the preview is fetched so it does not push the
  // rest of the timeline around when it resolves.
  if (!data && isLoading) {
    return (
      <div className={css.skeletonCard} aria-hidden="true">
        <div className={css.skeletonBar} style={{ width: '70%' }} />
        <div className={css.skeletonBar} style={{ width: '92%' }} />
        <div className={css.skeletonBar} style={{ width: '30%' }} />
      </div>
    );
  }
  if (!data) return null;

  const title = data['og:title'];
  if (!title) return null;

  const description = data['og:description'];
  const ogUrl = data['og:url'] ?? url;

  let siteName: string | null = null;
  try {
    const hostname = new URL(ogUrl).hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    siteName = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  } catch {
    // ignore
  }

  const rawW = Number(data['og:image:width']);
  const rawH = Number(data['og:image:height']);
  const imageAspect =
    Number.isFinite(rawW) && Number.isFinite(rawH) && rawW > 0 && rawH > 0
      ? `${rawW} / ${rawH}`
      : undefined;

  return (
    <div className={css.card}>
      {ogImage && !imgError && (
        <div
          className={css.imageBox}
          style={imageAspect ? { aspectRatio: imageAspect } : undefined}
        >
          {imgSrc && (
            <img
              src={imgSrc}
              alt=""
              className={imgLoaded ? `${css.image} ${css.imageLoaded}` : css.image}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          )}
        </div>
      )}
      <div className={css.body}>
        <Tooltip content={url} placement="top">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={css.title}
            onClick={(e) => e.stopPropagation()}
          >
            {title}
          </a>
        </Tooltip>
        {description && <span className={css.description}>{description}</span>}
        {siteName && <span className={css.siteName}>{siteName}</span>}
      </div>
    </div>
  );
}

export function LinkPreview(props: LinkPreviewProps) {
  const video = parseYouTubeUrl(props.url);
  if (video) return <YouTubeEmbed {...props} video={video} />;
  return <GenericLinkPreview {...props} />;
}
