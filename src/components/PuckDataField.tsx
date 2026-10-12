'use client';

import { useDocumentInfo, useField } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

type PuckDataValue = {
  content?: Array<{ type?: string }>;
  root?: Record<string, unknown>;
  zones?: Record<string, unknown>;
};

export function PuckDataField({ path }: { path?: string }) {
  const { value } = useField({ path });
  const router = useRouter();
  const { collectionSlug, id } = useDocumentInfo();

  const blockCount = useMemo(() => {
    const data = value as PuckDataValue | undefined;
    if (!data || typeof data !== 'object' || !Array.isArray(data.content)) {
      return 0;
    }

    return data.content.length;
  }, [value]);

  const isPageSaved = Boolean(id) && collectionSlug === 'pages';

  return (
    <div
      style={{
        display: 'grid',
        gap: '0.75rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
        }}
      >
        <strong>{blockCount}</strong> blocos nesta página
      </div>

      <button
        type="button"
        disabled={!isPageSaved}
        onClick={() => {
          if (!isPageSaved || !id) {
            return;
          }

          router.push(`/admin/puck-editor/pages/${String(id)}`);
        }}
        style={{
          alignSelf: 'flex-start',
          backgroundColor: isPageSaved ? '#0f172a' : '#cbd5e1',
          border: 'none',
          borderRadius: '0.5rem',
          color: '#fff',
          cursor: isPageSaved ? 'pointer' : 'not-allowed',
          fontWeight: 600,
          padding: '0.75rem 1rem',
        }}
      >
        Abrir editor visual
      </button>
    </div>
  );
}
