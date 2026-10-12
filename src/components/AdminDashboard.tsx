'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type PageRef = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  updatedAt?: string;
};

export function AdminDashboard({ pages }: { pages: PageRef[] }) {
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTitle = title.trim() || 'Nova página';
    setIsCreating(true);

    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: nextTitle, status: 'draft' }),
      });

      if (!response.ok) {
        throw new Error('Não foi possível criar a página');
      }

      const page = await response.json();
      router.push(`/admin/pages/${page.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Páginas</h1>
        </div>

        <button
          type="button"
          onClick={() => void fetch('/api/auth/logout', { method: 'POST' }).then(() => router.refresh())}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sair
        </button>
      </div>

      <form onSubmit={handleCreate} className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-slate-700">Título da página</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Sobre nós"
            className="h-12 flex-1 rounded-full border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-0 focus:border-slate-900"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="h-12 rounded-full bg-slate-900 px-5 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? 'Criando...' : 'Nova página'}
          </button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pages.map((page) => (
          <div key={page.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-600">
                {page.status}
              </span>
              <span className="text-xs text-slate-500">/{page.slug}</span>
            </div>

            <h2 className="text-xl font-semibold text-slate-900">{page.title}</h2>

            <div className="mt-4 flex items-center justify-between">
              <a href={`/admin/pages/${page.id}`} className="font-medium text-slate-900 underline decoration-2 underline-offset-4">
                Abrir editor
              </a>
              <a href={`/${page.slug}`} className="text-sm text-slate-600 hover:text-slate-900">
                Ver no site
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
