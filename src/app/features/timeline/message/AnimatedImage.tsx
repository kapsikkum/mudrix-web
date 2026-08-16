import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAtomValue } from 'jotai';
import { preferencesAtom } from '@/app/store/atoms';
import { animatedImageBadge } from '../Timeline.css';
import { firstFrameToBlobUrl, mayBeAnimated } from '../utils/imageAnimation';

const stillCache = new Map<string, string>();
const MAX_STILL_CACHE = 500;

function cacheStill(key: string, url: string): void {
  const existing = stillCache.get(key);
  if (existing && existing !== url) {
    URL.revokeObjectURL(existing);
  }
  if (stillCache.size >= MAX_STILL_CACHE) {
    const lruKey = stillCache.keys().next().value;
    if (lruKey !== undefined) {
      const evicted = stillCache.get(lruKey);
      if (evicted) URL.revokeObjectURL(evicted);
      stillCache.delete(lruKey);
    }
  }
  stillCache.set(key, url);
}

interface AnimatedImageProps {
  src: string;
  alt?: string;
  mimeType?: string;
  isAnimated?: boolean;
  className?: string;
  wrapperClassName?: string;
  preferAutoplay?: boolean;
  style?: CSSProperties;
  loading?: 'lazy' | 'eager';
  onClick?: () => void;
}

export function AnimatedImage({
  src,
  alt,
  mimeType,
  isAnimated,
  className,
  wrapperClassName,
  preferAutoplay = false,
  style,
  loading = 'lazy',
  onClick,
}: AnimatedImageProps) {
  const prefs = useAtomValue(preferencesAtom);
  const [stillUrl, setStillUrl] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);

  const isAnimationCandidate = isAnimated === true || mayBeAnimated(mimeType);

  const staticMode = !preferAutoplay && !prefs.autoplayGifs;
  const wantsStill = staticMode && isAnimationCandidate;

  useEffect(() => {
    if (!wantsStill) {
      setStillUrl(null);
      return;
    }
    let cancelled = false;
    const cached = stillCache.get(src);
    if (cached) {
      setStillUrl(cached);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      void firstFrameToBlobUrl(img, mimeType).then((url) => {
        if (cancelled || url === null) return;
        cacheStill(src, url);
        setStillUrl(url);
      });
      img.src = '';
    };
    img.src = src;
    return () => {
      cancelled = true;
      img.src = '';
    };
  }, [src, mimeType, wantsStill]);

  const showStill = wantsStill && !!stillUrl && !hovering;
  const showBadge = staticMode && isAnimationCandidate && !hovering;

  return (
    <span
      className={wrapperClassName}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <img
        src={showStill ? stillUrl : src}
        alt={alt}
        draggable={false}
        className={className}
        style={style}
        loading={loading}
        onClick={onClick}
      />
      {showBadge && <span className={animatedImageBadge}>GIF</span>}
    </span>
  );
}
