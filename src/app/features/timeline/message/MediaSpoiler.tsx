import { useTranslation } from 'react-i18next';
import * as css from '../Timeline.css';

interface MediaSpoilerProps {
  reason?: string;
  interactive?: boolean;
  onReveal?: () => void;
}

export function MediaSpoiler({ reason, interactive = true, onReveal }: MediaSpoilerProps) {
  const { t } = useTranslation();
  const inner = (
    <>
      {reason && <span className={css.mediaSpoilerReason}>{reason}</span>}
      <span className={css.mediaSpoilerChip}>{t('timeline.spoilerMedia')}</span>
    </>
  );

  if (!interactive) {
    return (
      <span className={css.mediaSpoilerOverlay} aria-hidden="true">
        {inner}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={css.mediaSpoilerOverlay}
      onClick={onReveal}
      aria-label={t('timeline.revealSpoiler')}
    >
      {inner}
    </button>
  );
}
