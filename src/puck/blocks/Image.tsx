import { MediaImage } from './MediaImage';
import type { MediaValue, PuckRenderContext } from './types';

export type ImageProps = PuckRenderContext & {
  image?: MediaValue;
  caption?: string;
};

export const imageDefaults: ImageProps = {
  caption: '',
  image: null,
};

export function renderImage({ caption = imageDefaults.caption, image = null }: ImageProps) {
  return (
    <figure style={{ margin: '1.5rem auto', maxWidth: 'var(--puck-content-width)' }}>
      <MediaImage
        image={image}
        style={{ background: 'var(--puck-color-surface-muted)', borderRadius: 'var(--puck-radius-card)', display: 'block', height: 'auto', maxWidth: '100%', objectFit: 'contain', width: image?.width ?? '100%' }}
      />
      {caption ? <figcaption style={{ color: 'var(--puck-color-muted)', fontSize: '0.9rem', marginTop: '0.65rem', textAlign: 'center' }}>{caption}</figcaption> : null}
    </figure>
  );
}
