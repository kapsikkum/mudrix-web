import type { MatrixClient } from 'matrix-js-sdk';
import { useMediaBlobUrl } from '@/app/components/Avatar/useMediaBlobUrl';

export interface AuthMediaImgProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'width' | 'height'
> {
  client: MatrixClient | null | undefined;
  mxcUrl: string | undefined | null;
  width?: number;
  height?: number;
}

export function AuthMediaImg({ client, mxcUrl, width, height, alt, ...rest }: AuthMediaImgProps) {
  const { src } = useMediaBlobUrl(client, mxcUrl, { width, height });
  return <img {...rest} src={src} alt={alt} />;
}

export default AuthMediaImg;
