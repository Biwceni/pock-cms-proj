'use client';

import Link from 'next/link';
import { useAuth } from '@payloadcms/ui';

export function NewPageAction() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }

  return (
    <Link
      aria-label="Criar nova página"
      href="/admin/nova-pagina"
      style={{
        border: '1px solid currentColor',
        borderRadius: '0.375rem',
        display: 'inline-flex',
        padding: '0.4rem 0.75rem',
      }}
    >
      Nova página
    </Link>
  );
}
