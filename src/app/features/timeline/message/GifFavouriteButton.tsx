import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StarIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { isFavourited, toggleFavourite } from '../composer/gifFavourites';
import type { GifItem } from '../composer/gifProviders';
import * as css from '../Timeline.css';

interface GifFavouriteButtonProps {
  item: GifItem;
}

/** Discord-style star overlay that favourites a GIF straight from the message bubble. */
export function GifFavouriteButton({ item }: GifFavouriteButtonProps) {
  const { t } = useTranslation();
  const [fav, setFav] = useState(() => isFavourited(item));

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFavourite(item);
      setFav((prev) => !prev);
    },
    [item]
  );

  const label = fav ? t('composer.removeFavourite') : t('composer.addFavourite');

  return (
    <Tooltip content={label} placement="top">
      <button
        type="button"
        className={css.gifFavouriteBtn}
        data-active={fav}
        onClick={handleClick}
        aria-label={label}
      >
        <StarIcon size={14} weight={fav ? 'fill' : 'regular'} />
      </button>
    </Tooltip>
  );
}
