import Image from 'next/image';
import { sanitizeImageUrl } from '@/src/lib/puck-urls';
import type { MediaValue } from './types';

export function MediaImage({
  className,
  image,
  style,
}: {
  className?: string;
  image: MediaValue;
  style?: React.CSSProperties;
}) {
  const src = sanitizeImageUrl(image?.url);
  if (!image || !src) {
    return null;
  }

  return (
    <Image
      alt={image.alt}
      className={className}
      height={image.height}
      src={src}
      style={style}
      unoptimized
      width={image.width}
    />
  );
}
