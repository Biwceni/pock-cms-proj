import type { PuckRenderContext } from './types';

export type SpacerProps = PuckRenderContext & {
  size?: 'pequeno' | 'médio' | 'grande';
};

export const spacerDefaults: SpacerProps = { size: 'médio' };

const heights = {
  grande: '5rem',
  médio: '3rem',
  pequeno: '1.5rem',
} as const;

export function renderSpacer({ size = spacerDefaults.size }: SpacerProps) {
  const resolvedSize = size ?? 'médio';
  return <div aria-hidden="true" style={{ height: heights[resolvedSize], width: '100%' }} />;
}
