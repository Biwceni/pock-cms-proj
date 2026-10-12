import { sanitizeLinkUrl } from '@/src/lib/puck-urls';
import { MediaImage } from './MediaImage';
import type { MediaValue, PuckRenderContext } from './types';

export type BannerProps = PuckRenderContext & {
  backgroundImage?: MediaValue;
  buttonLabel?: string;
  buttonUrl?: string;
  subtitle?: string;
  title?: string;
};

export const bannerDefaults: BannerProps = {
  backgroundImage: null,
  buttonLabel: 'Saiba mais',
  buttonUrl: '/contato',
  subtitle: 'Uma mensagem clara para apresentar sua marca.',
  title: 'Destaque sua ideia',
};

export function renderBanner({
  backgroundImage,
  buttonLabel = bannerDefaults.buttonLabel,
  buttonUrl = bannerDefaults.buttonUrl,
  subtitle = bannerDefaults.subtitle,
  title = bannerDefaults.title,
}: BannerProps) {
  const safeUrl = sanitizeLinkUrl(buttonUrl);
  return (
    <section
      style={{
        alignItems: 'center',
        background: 'linear-gradient(120deg, #172033, #364b70)',
        borderRadius: 'var(--puck-radius-card)',
        color: '#fff',
        display: 'flex',
        minHeight: '24rem',
        overflow: 'hidden',
        padding: 'var(--puck-space-section) clamp(1.5rem, 6vw, 5rem)',
        position: 'relative',
      }}
    >
      <MediaImage
        image={backgroundImage ?? null}
        style={{ height: '100%', inset: 0, objectFit: 'cover', opacity: 0.35, position: 'absolute', width: '100%' }}
      />
      <div style={{ maxWidth: '42rem', position: 'relative' }}>
        <h1 style={{ fontFamily: 'var(--puck-font-body)', fontSize: 'clamp(2.25rem, 6vw, 4.5rem)', lineHeight: 1.05, margin: 0 }}>
          {title}
        </h1>
        <p style={{ fontSize: '1.2rem', lineHeight: 1.65, margin: '1.25rem 0 0', maxWidth: '38rem' }}>
          {subtitle}
        </p>
        {safeUrl ? (
          <a
            href={safeUrl}
            style={{
              background: 'var(--puck-color-primary)',
              borderRadius: 'var(--puck-radius-control)',
              color: '#fff',
              display: 'inline-block',
              fontWeight: 700,
              marginTop: '1.75rem',
              padding: '0.85rem 1.2rem',
              textDecoration: 'none',
            }}
          >
            {buttonLabel}
          </a>
        ) : null}
      </div>
    </section>
  );
}
