import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Render } from '@puckeditor/core/rsc';
import type { Data } from '@puckeditor/core';
import { getPayloadInstance } from '@/src/lib/payload';
import { renderConfig } from '@/puck/config.render';

type PageParams = Promise<{ slug?: string[] }>;

type SeoFields = {
  metaDescription?: string | null;
  metaImage?: { url?: string | null } | number | null;
  metaTitle?: string | null;
};

type PublicPage = {
  puckData?: Data | null;
  seo?: SeoFields | null;
  slug?: string | null;
  title?: string | null;
};

function hasPuckContent(data: unknown): data is Data {
  if (typeof data !== 'object' || data === null || !('content' in data)) {
    return false;
  }

  return Array.isArray(data.content) && data.content.length > 0;
}

async function getPublishedPage(slugPath: string): Promise<PublicPage | null> {
  const payload = await getPayloadInstance();
  const result = await payload.find({
    collection: 'pages',
    where: {
      slug: { equals: slugPath },
    },
    draft: false,
    depth: 1,
    limit: 1,
    overrideAccess: false,
  });

  return (result.docs[0] as PublicPage | undefined) ?? null;
}

function metadataForPage(page: PublicPage): Metadata {
  const imageUrl =
    typeof page.seo?.metaImage === 'object' && page.seo.metaImage !== null
      ? page.seo.metaImage.url
      : undefined;

  return {
    title: page.seo?.metaTitle || page.title || undefined,
    description: page.seo?.metaDescription || undefined,
    openGraph: imageUrl ? { images: [imageUrl] } : undefined,
  };
}

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const slugPath = slug?.length ? slug.join('/') : 'home';
  const page = await getPublishedPage(slugPath);

  if (!page || !hasPuckContent(page.puckData)) {
    notFound();
  }

  return metadataForPage(page);
}

export default async function FrontendPage({
  params,
}: {
  params: PageParams;
}) {
  const { slug } = await params;
  const slugPath = slug?.length ? slug.join('/') : 'home';
  const page = await getPublishedPage(slugPath);

  if (!page || !hasPuckContent(page.puckData)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
        <Render config={renderConfig} data={page.puckData} />
      </div>
    </main>
  );
}
