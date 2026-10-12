import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps } from 'payload';
import { NewPageForm } from './NewPageForm';

export async function NewPageView({ initPageResult }: AdminViewServerProps) {
  if (!initPageResult.req.user) {
    redirect('/admin/login');
  }

  return (
    <main style={{ margin: '0 auto', maxWidth: '52rem', padding: '2rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/collections/pages">Voltar para Páginas</Link>
        <h1>Nova página</h1>
        <p>Informe o título. Depois, você poderá montar e publicar a página no editor visual.</p>
      </header>
      <NewPageForm />
    </main>
  );
}
