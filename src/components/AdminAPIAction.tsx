'use client';

import { useAuth } from '@payloadcms/ui';

export function AdminAPIAction() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <a
      aria-label="Abrir API de páginas"
      href="/api/pages"
      rel="noreferrer"
      style={{
        border: '1px solid currentColor',
        borderRadius: '0.375rem',
        display: 'inline-flex',
        padding: '0.4rem 0.75rem',
      }}
      target="_blank"
    >
      API
    </a>
  );
}
