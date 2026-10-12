import type { PuckRenderContext } from './types';

export type TextProps = PuckRenderContext & {
  align?: 'left' | 'center' | 'right';
  text?: string;
};

export const textDefaults: TextProps = {
  align: 'left',
  text: 'Adicione aqui o texto da sua página.',
};

export function renderText({ align = 'left', text = textDefaults.text }: TextProps) {
  return <p style={{ color: 'var(--puck-color-muted)', fontFamily: 'var(--puck-font-body)', fontSize: '1.05rem', lineHeight: 1.75, margin: '0 0 1rem', textAlign: align }}>{text}</p>;
}
