'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { pageTemplates, type PageTemplateID } from '@/src/puck/page-templates';

function isPageTemplateID(value: string): value is PageTemplateID {
  return Object.hasOwn(pageTemplates, value);
}

export function NewPageForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<PageTemplateID>('blank');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pageTitle = title.trim();
    if (!pageTitle) {
      setErrorMessage('Informe o título da página.');
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/pages?draft=true', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          _status: 'draft',
          puckData: structuredClone(pageTemplates[template].data),
          title: pageTitle,
        }),
      });

      const result = (await response.json()) as {
        doc?: { id?: number | string };
        errors?: Array<{ message?: string }>;
        id?: number | string;
      };
      if (!response.ok) {
        throw new Error(
          result.errors?.[0]?.message ??
            `Não foi possível criar a página (HTTP ${response.status}).`,
        );
      }

      const id = result.doc?.id ?? result.id;
      if (id === undefined || id === null) {
        throw new Error('A página foi criada, mas o Payload não retornou seu identificador.');
      }

      router.push(`/admin/puck-editor/pages/${encodeURIComponent(String(id))}`);
    } catch (error) {
      setIsCreating(false);
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível criar a página.',
      );
    }
  }

  return (
    <form
      onSubmit={(event) => void createPage(event)}
      style={{ display: 'grid', gap: '1rem', maxWidth: '38rem' }}
    >
      <label style={{ display: 'grid', gap: '0.4rem' }}>
        Título da página
        <input
          autoFocus
          maxLength={200}
          onChange={(event) => setTitle(event.currentTarget.value)}
          required
          value={title}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.4rem' }}>
        Modelo
        <select
          onChange={(event) => {
            if (isPageTemplateID(event.currentTarget.value)) {
              setTemplate(event.currentTarget.value);
            }
          }}
          value={template}
        >
          {Object.entries(pageTemplates).map(([id, item]) => (
            <option key={id} value={id}>
              {item.label} — {item.description}
            </option>
          ))}
        </select>
      </label>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <button disabled={isCreating} type="submit">
        {isCreating ? 'Criando página…' : 'Criar e abrir editor'}
      </button>
    </form>
  );
}
