import { notFound, redirect } from 'next/navigation';
import type { AdminViewServerProps } from 'payload';
import { PuckEditorClient } from './PuckEditorClient';
import { findEditablePage } from '@/src/lib/puck-editor-access';
import { getPuckEditorRouteParams } from '@/src/lib/puck-editor-route';
import { emptyPuckData } from '@/src/puck/config';

function isPuckData(value: unknown): value is import('@puckeditor/core').Data {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const data = value as Record<string, unknown>;
  return (
    typeof data.root === 'object' &&
    data.root !== null &&
    !Array.isArray(data.root) &&
    Array.isArray(data.content) &&
    (data.zones === undefined ||
      (typeof data.zones === 'object' && data.zones !== null && !Array.isArray(data.zones)))
  );
}

export async function PuckEditorView({
  initPageResult,
  params,
  payload,
}: AdminViewServerProps) {
  const req = initPageResult.req;
  if (!req.user) {
    redirect('/admin/login');
  }

  const routeParams = getPuckEditorRouteParams(params);
  if (!routeParams || routeParams.collection !== 'pages') {
    notFound();
  }

  const page = await findEditablePage({
    collection: routeParams.collection,
    id: routeParams.id,
    payload,
    req,
  });
  if (!page) {
    notFound();
  }

  const initialData =
    page.puckData === null || page.puckData === undefined
      ? emptyPuckData
      : isPuckData(page.puckData)
        ? page.puckData
        : null;

  if (!initialData) {
    throw new Error('O conteúdo salvo da página não tem um formato Puck válido.');
  }

  const editorData = {
    ...initialData,
    root: {
      ...initialData.root,
      props: {
        ...initialData.root.props,
        title: page.title,
      },
      readOnly: {
        ...initialData.root.readOnly,
        title: true,
      },
    },
  };

  return (
    <main>
      <PuckEditorClient
        initialPublished={page._status === 'published'}
        pageId={String(page.id)}
        pageSlug={page.slug ?? String(page.id)}
        title={page.title}
        initialData={editorData}
      />
    </main>
  );
}
