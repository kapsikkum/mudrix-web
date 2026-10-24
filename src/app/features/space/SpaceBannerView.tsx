import type { MatrixClient } from 'matrix-js-sdk';
import { AuthMediaImg } from '@/app/components/AuthMediaImg';
import { presetCss, type SpaceBanner } from './spaceBanner';
import * as css from './SpaceBanner.css';

interface SpaceBannerViewProps {
  client: MatrixClient | null | undefined;
  banner: SpaceBanner | null;
  className?: string;
}

/** A space's banner: its image, or its gradient, or a neutral fill when it has none. */
export function SpaceBannerView({ client, banner, className }: SpaceBannerViewProps) {
  const gradient = presetCss(banner?.color);
  return (
    <div
      className={[css.view, className].filter(Boolean).join(' ')}
      style={!banner?.url && gradient ? { background: gradient } : undefined}
    >
      {banner?.url ? (
        <AuthMediaImg
          client={client}
          mxcUrl={banner.url}
          alt=""
          placeholder="none"
          className={css.viewImage}
        />
      ) : null}
    </div>
  );
}
