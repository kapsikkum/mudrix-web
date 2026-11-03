import { useTranslation } from 'react-i18next';
import { PlayIcon, XIcon } from '@phosphor-icons/react';
import { formatDuration, formatFileSize } from '@/util/format';
import type { ManualVideoLoad } from './encryption';
import * as css from '../Timeline.css';

interface VideoPlaceholderProps {
  poster: string | null;
  sizeBytes?: number;
  durationMs?: number;
  load: ManualVideoLoad;
}

/** Stands in for a large video until the user chooses to download it; fills its mediaBox parent. */
export function VideoPlaceholder({ poster, sizeBytes, durationMs, load }: VideoPlaceholderProps) {
  const { t } = useTranslation();
  const { progress } = load;
  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.floor((progress.loaded / progress.total) * 100))
      : null;

  const meta = [
    sizeBytes !== undefined ? formatFileSize(sizeBytes) : null,
    durationMs !== undefined && durationMs > 0 ? formatDuration(durationMs) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {poster ? (
        <img className={css.mediaFill} src={poster} alt="" draggable={false} />
      ) : (
        <div className={css.mediaBoxPulse} />
      )}
      {load.checking ? null : load.loading ? (
        <div className={css.videoProgressPanel}>
          <div
            className={css.videoProgressTrack}
            role="progressbar"
            aria-label={t('timeline.video.downloading', { defaultValue: 'Downloading video' })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
          >
            <div className={css.videoProgressFill} style={{ width: `${percent ?? 0}%` }} />
          </div>
          <span className={css.videoProgressText}>
            {percent !== null ? `${percent}%` : progress ? formatFileSize(progress.loaded) : '0%'}
          </span>
          <button
            type="button"
            className={css.videoCancelBtn}
            onClick={load.cancel}
            aria-label={t('timeline.video.cancelDownload', { defaultValue: 'Cancel download' })}
          >
            <XIcon size={14} weight="bold" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={css.videoPlayOverlay}
          onClick={load.start}
          aria-label={t('timeline.video.play', {
            defaultValue: 'Download and play video',
          })}
        >
          <span className={css.videoPlayCircle}>
            <PlayIcon size={24} weight="fill" />
          </span>
          {meta && <span className={css.videoMetaChip}>{meta}</span>}
        </button>
      )}
    </>
  );
}
