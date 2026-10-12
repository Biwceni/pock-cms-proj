import type { Payload, PayloadRequest } from 'payload';

type EditorAccessArgs = {
  collection: string | undefined;
  id: string;
  payload: Payload;
  req: PayloadRequest;
};

export async function findEditablePage({
  collection,
  id,
  payload,
  req,
}: EditorAccessArgs) {
  if (!req.user || collection !== 'pages') {
    return null;
  }

  const pageID = Number(id);
  if (!Number.isSafeInteger(pageID) || pageID <= 0) {
    return null;
  }

  const page = await payload.findByID({
    collection: 'pages',
    id: pageID,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req,
  });

  const updateAccess = payload.collections.pages.config.access?.update;
  const accessResult = updateAccess
    ? await updateAccess({
      id: pageID,
        data: page,
        collectionConfig: payload.collections.pages.config,
        req,
      })
    : Boolean(req.user);

  if (accessResult === false) {
    return null;
  }

  if (typeof accessResult === 'object') {
    const matchingPages = await payload.find({
      collection: 'pages',
      where: {
        and: [{ id: { equals: pageID } }, accessResult],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    });

    if (matchingPages.docs.length === 0) {
      return null;
    }
  }

  return page;
}
