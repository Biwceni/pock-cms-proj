import { revalidatePath } from 'next/cache';
import type { RequestContext } from 'payload';

type PublishedPage = {
  _status?: string | null;
  puckData?: unknown;
  seo?: unknown;
  slug?: string | null;
  title?: string | null;
};

function pagePath(slug: string): string {
  return slug === 'home' ? '/' : `/${slug}`;
}

export function revalidatePageChange({
  context,
  doc,
  previousDoc,
}: {
  context: RequestContext;
  doc: PublishedPage;
  previousDoc?: PublishedPage;
}): void {
  if (context.disablePageRevalidation === true) {
    return;
  }

  const isPublished = doc._status === 'published';
  const wasPublished = previousDoc?._status === 'published';
  const publishStateChanged = isPublished !== wasPublished;
  const slugChanged = previousDoc?.slug !== doc.slug;
  const visibleContentChanged =
    isPublished &&
    previousDoc !== undefined &&
    (previousDoc.title !== doc.title ||
      JSON.stringify(previousDoc.puckData) !== JSON.stringify(doc.puckData) ||
      JSON.stringify(previousDoc.seo) !== JSON.stringify(doc.seo));

  if (!publishStateChanged && !slugChanged && !visibleContentChanged) {
    return;
  }

  if (wasPublished && previousDoc?.slug) {
    revalidatePath(pagePath(previousDoc.slug));
  }

  if (isPublished && doc.slug) {
    revalidatePath(pagePath(doc.slug));
  }
}

export function revalidatePageDelete({
  context,
  doc,
}: {
  context: RequestContext;
  doc: PublishedPage;
}): void {
  if (context.disablePageRevalidation === true) {
    return;
  }

  if (doc._status === 'published' && doc.slug) {
    revalidatePath(pagePath(doc.slug));
  }
}
