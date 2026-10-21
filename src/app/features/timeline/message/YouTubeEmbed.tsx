import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useLinkPreview } from '@/app/hooks/useLinkPreview';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';
import { STORAGE_KEY_YOUTUBE_CONSENT } from '@/const/storageKeys';
import type { YouTubeVideo } from '@/util/youtube';
import * as css from './LinkPreview.css';

interface YouTubeEmbedProps {
  url: string;
  video: YouTubeVideo;
  client: MatrixClient;
  isEncrypted: boolean;
}

function hasConsent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_YOUTUBE_CONSENT) === '1';
  } catch {
    return false;
  }
}

/**
 * A YouTube link as a Discord-style card. Nothing is requested from YouTube until the video is
 * played: the title and thumbnail come from the homeserver's URL preview (so YouTube never sees
 * this device, and encrypted rooms get a plain card since previews are off there). Playing asks
 * once for consent, then loads the privacy-enhanced youtube-nocookie.com player.
 */
export function YouTubeEmbed({ url, video, client, isEncrypted }: YouTubeEmbedProps) {
  const { t } = useTranslation();
  const { data } = useLinkPreview(client, url, isEncrypted);
  const [thumb, setThumb] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [playing, setPlaying] = useState(false);

  const ogImage = data?.['og:image'];
  useEffect(() => {
    setThumb(null);
    if (!ogImage) return undefined;
    if (!ogImage.startsWith('mxc://')) return undefined; // never load a direct third-party image
    let cancelled = false;
    let blobUrl: string | null = null;
    fetchMediaBlobUrl(ogImage, client, 1).then((u) => {
      if (!u) return;
      if (cancelled) {
        URL.revokeObjectURL(u);
        return;
      }
      blobUrl = u;
      setThumb(u);
    });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [ogImage, client]);

  const title = data?.['og:title'] || t('timeline.youtube.video');
  const channel = data?.['og:site_name'] ?? 'YouTube';

  const start = () => {
    if (hasConsent()) setPlaying(true);
    else setAsking(true);
  };
  const allow = (always: boolean) => {
    if (always) {
      try {
        localStorage.setItem(STORAGE_KEY_YOUTUBE_CONSENT, '1');
      } catch {
        // consent just isn't remembered
      }
    }
    setAsking(false);
    setPlaying(true);
  };

  const embedSrc = `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0${
    video.start > 0 ? `&start=${video.start}` : ''
  }`;

  return (
    <div className={css.ytCard}>
      <div className={css.ytPlayer}>
        {playing ? (
          <iframe
            className={css.ytFrame}
            src={embedSrc}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <>
            {thumb && <img className={css.ytThumb} src={thumb} alt="" />}
            {asking ? (
              <div className={css.ytConsent}>
                <p className={css.ytConsentText}>{t('timeline.youtube.consent')}</p>
                <div className={css.ytConsentActions}>
                  <button type="button" className={css.ytBtnPrimary} onClick={() => allow(true)}>
                    {t('timeline.youtube.always')}
                  </button>
                  <button type="button" className={css.ytBtn} onClick={() => allow(false)}>
                    {t('timeline.youtube.once')}
                  </button>
                  <button type="button" className={css.ytBtn} onClick={() => setAsking(false)}>
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={css.ytPlay}
                onClick={start}
                aria-label={t('timeline.youtube.play')}
              >
                <PlayIcon size={28} weight="fill" />
              </button>
            )}
          </>
        )}
      </div>
      <div className={css.body}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={css.title}
          onClick={(e) => e.stopPropagation()}
        >
          {title}
        </a>
        <span className={css.siteName}>{channel}</span>
      </div>
    </div>
  );
}
