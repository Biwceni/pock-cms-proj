import type { PuckRenderContext } from './types';

export type HeadingProps = PuckRenderContext & {
  level?: 'h1' | 'h2' | 'h3';
  text?: string;
};

export const headingDefaults: HeadingProps = {
  level: 'h2',
  text: 'Título da seção',
};

export function renderHeading({ level = 'h2', text = headingDefaults.text }: HeadingProps) {
  const Tag = level;
  return <Tag style={{ color: 'var(--puck-color-ink)', fontFamily: 'var(--puck-font-body)', lineHeight: 1.15, margin: '0.5rem 0 1rem' }}>{text}</Tag>;
}
