import { sanitizeLinkUrl } from '@/src/lib/puck-urls';
import { MediaImage } from './MediaImage';
import type { MediaValue, PuckRenderContext } from './types';

export type CardItem = {
  image?: MediaValue;
  text: string;
  title: string;
  url: string;
};

export type CardGridProps = PuckRenderContext & {
  cards?: CardItem[];
  columns?: '2' | '3' | '4';
  title?: string;
};

export const cardGridDefaults: CardGridProps = {
  cards: [
    { image: null, text: 'Apresente um benefício de forma simples.', title: 'Primeiro destaque', url: '/sobre' },
    { image: null, text: 'Explique como sua solução ajuda as pessoas.', title: 'Segundo destaque', url: '/servicos' },
    { image: null, text: 'Convide o visitante a conhecer mais.', title: 'Terceiro destaque', url: '/contato' },
  ],
  columns: '3',
  title: 'Conheça nossos destaques',
};

export function renderCardGrid({
  cards = cardGridDefaults.cards,
  columns = '3',
  title = cardGridDefaults.title,
}: CardGridProps) {
  const count = Number(columns);
  const minimumCardWidth = count === 2 ? '20rem' : count === 3 ? '15rem' : '12rem';
  return (
    <section style={{ color: 'var(--puck-color-ink)', fontFamily: 'var(--puck-font-body)' }}>
      {title ? <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', margin: '0 0 1.5rem' }}>{title}</h2> : null}
      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minimumCardWidth}), 1fr))` }}>
        {cards?.map((card, index) => {
          const safeUrl = sanitizeLinkUrl(card.url);
          const content = (
            <>
              <MediaImage
                image={card.image ?? null}
                style={{ aspectRatio: '16 / 9', background: 'var(--puck-color-surface-muted)', borderRadius: '0.75rem', objectFit: 'cover', width: '100%' }}
              />
              <h3 style={{ color: 'var(--puck-color-ink)', fontSize: '1.2rem', margin: '1rem 0 0.5rem' }}>{card.title}</h3>
              <p style={{ color: 'var(--puck-color-muted)', lineHeight: 1.6, margin: 0 }}>{card.text}</p>
            </>
          );
          return (
            <article key={`${card.title}-${index}`} style={{ background: 'var(--puck-color-surface)', border: '1px solid var(--puck-color-border)', borderRadius: 'var(--puck-radius-card)', padding: '1rem' }}>
              {safeUrl ? <a href={safeUrl} style={{ textDecoration: 'none' }}>{content}</a> : content}
            </article>
          );
        })}
      </div>
    </section>
  );
}
