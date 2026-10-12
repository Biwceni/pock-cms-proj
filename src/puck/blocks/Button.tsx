import { sanitizeLinkUrl } from '@/src/lib/puck-urls';
import type { PuckRenderContext } from './types';

export type ButtonProps = PuckRenderContext & {
  label?: string;
  style?: 'primário' | 'secundário';
  url?: string;
};

export const buttonDefaults: ButtonProps = {
  label: 'Saiba mais',
  style: 'primário',
  url: '/contato',
};

export function renderButton({
  label = buttonDefaults.label,
  style = 'primário',
  url = buttonDefaults.url,
}: ButtonProps) {
  const safeUrl = sanitizeLinkUrl(url);
  if (!safeUrl) {
    return <span aria-hidden="true" />;
  }

  const primary = style === 'primário';
  return (
    <a
      href={safeUrl}
      style={{
        background: primary ? 'var(--puck-color-primary)' : 'transparent',
        border: `1px solid ${primary ? 'var(--puck-color-primary)' : 'var(--puck-color-border)'}`,
        borderRadius: 'var(--puck-radius-control)',
        color: primary ? '#fff' : 'var(--puck-color-primary)',
        display: 'inline-block',
        fontFamily: 'var(--puck-font-body)',
        fontWeight: 700,
        padding: '0.85rem 1.2rem',
        textDecoration: 'none',
      }}
    >
      {label}
    </a>
  );
}
