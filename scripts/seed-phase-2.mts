import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { phaseTwoDraftData, phaseTwoPageData } from '../puck/sample-data';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const email = process.env.PAYLOAD_SEED_EMAIL;
const password = process.env.PAYLOAD_SEED_PASSWORD;

if (!email || !password) {
  throw new Error('Set PAYLOAD_SEED_EMAIL and PAYLOAD_SEED_PASSWORD to run this seed.');
}

const [{ getPayload }, { default: config }] = await Promise.all([
  import('payload'),
  import('../payload.config'),
]);
const payload = await getPayload({ config });
const context = { disablePageRevalidation: true };

try {
  const { user } = await payload.login({
    collection: 'users',
    data: { email, password },
  });

  if (user?.role !== 'admin') {
    throw new Error('The seed requires an authenticated admin user.');
  }

  const runID = randomUUID();
  const published = await payload.create({
    collection: 'pages',
    data: {
      title: `Validação Fase 2 ${runID}`,
      slug: `fase-2-publicada-${runID}`,
      puckData: phaseTwoPageData,
      _status: 'published',
    },
    overrideAccess: false,
    user,
    context,
  });

  const draft = await payload.create({
    collection: 'pages',
    data: {
      title: `Rascunho Fase 2 ${runID}`,
      slug: `fase-2-rascunho-${runID}`,
      puckData: phaseTwoDraftData,
      _status: 'draft',
    },
    draft: true,
    overrideAccess: false,
    user,
    context,
  });

  console.log(
    JSON.stringify({
      published: { id: published.id, slug: published.slug },
      draft: { id: draft.id, slug: draft.slug },
    }),
  );
} finally {
  await payload.destroy();
}
