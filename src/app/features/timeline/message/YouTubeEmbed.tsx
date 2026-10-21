import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { PlayIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useLinkPreview } from '@/app/hooks/useLinkPreview';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';
import { youtubeEmbedsAtom } from '@/app/store/atoms';
import type { YouTubeVideo } from '@/util/youtube';
import * as css from './LinkPreview.css';

interface YouTubeEmbedProps {
  url: string;
  video: YouTubeVideo;
  client: MatrixClient;
  isEncrypted: boolean;
}

/**
 * A YouTube link as a Discord-style card. Nothing is requested from YouTube until the video is
 * played: the title and thumbnail come from the homeserver's URL preview (so YouTube never sees
 * this device, and encrypted rooms get a plain card since previews are off there).
 *
 * Until the user has answered the "show YouTube embeds?" prompt only a small prompt box is
 * shown. Allowing turns the big cards on (playing then loads the privacy-enhanced
 * youtube-nocookie.com player); declining hides embeds until they are allowed in Settings.
 */
export function YouTubeEmbed({ url, video, client, isEncrypted }: YouTubeEmbedProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useAtom(youtubeEmbedsAtom);
  const { data } = useLinkPreview(client, url, isEncrypted);
  const [thumb, setThumb] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const ogImage = data?.['og:image'];
  useEffect(() => {
    setThumb(null);
    if (mode !== 'on' || !ogImage?.startsWith('mxc://')) return undefined; // never a direct third-party image
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
  }, [ogImage, client, mode]);

  if (mode === 'off') return null;

  const title = data?.['og:title'] || t('timeline.youtube.video');

  if (mode === 'ask') {
    return (
      <div className={`${css.ytCard} ${css.ytPromptCard}`}>
        <span className={css.ytProvider}>YouTube</span>
        <span className={css.ytPromptText}>{t('timeline.youtube.consent')}</span>
        <div className={css.ytPromptActions}>
          <button type="button" className={css.ytBtnPrimary} onClick={() => setMode('on')}>
            {t('timeline.youtube.allow')}
          </button>
          <button type="button" className={css.ytBtn} onClick={() => setMode('off')}>
            {t('timeline.youtube.deny')}
          </button>
        </div>
      </div>
    );
  }

  const embedSrc = `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0${
    video.start > 0 ? `&start=${video.start}` : ''
  }`;

  return (
    <div className={css.ytCard}>
      <span className={css.ytProvider}>YouTube</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={css.ytTitle}
        onClick={(e) => e.stopPropagation()}
      >
        {title}
      </a>
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
            <button
              type="button"
              className={css.ytPlay}
              onClick={() => setPlaying(true)}
              aria-label={t('timeline.youtube.play')}
            >
              <PlayIcon size={26} weight="fill" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
