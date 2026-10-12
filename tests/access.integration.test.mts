import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Pool } from 'pg';
import sharp from 'sharp';
import { createLocalReq, getPayload } from 'payload';
import { findEditablePage } from '../src/lib/puck-editor-access';
import { getPuckEditorRouteParams } from '../src/lib/puck-editor-route';
import {
  sanitizeImageUrl,
  sanitizeLinkUrl,
  toRelativeImageUrl,
} from '../src/lib/puck-urls';
import { blockRegistry } from '../src/puck/blocks/registry';
import { editorConfig } from '../src/puck/config';
import { pageTemplates } from '../src/puck/page-templates';
import { renderConfig } from '../puck/config.render';
import { isStrongPayloadSecret } from '../src/lib/security';
import { validatePuckDataForPages } from '../src/lib/puck-validation';

Object.assign(process.env, { NODE_ENV: 'test' });

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

if (process.env.PAYLOAD_TEST_DATABASE_URI) {
  process.env.DATABASE_URI = process.env.PAYLOAD_TEST_DATABASE_URI;
}

const disableRevalidation = { disablePageRevalidation: true };

test('the visual editor resolves its collection and ID from the Next catch-all route params', () => {
  assert.deepEqual(
    getPuckEditorRouteParams({ segments: ['puck-editor', 'pages', '1'] }),
    { collection: 'pages', id: '1' },
  );
  assert.equal(
    getPuckEditorRouteParams({ segments: ['puck-editor', 'users', '1'] })?.collection,
    'users',
  );
  assert.equal(
    getPuckEditorRouteParams({ segments: ['puck-editor', 'pages'] }),
    null,
  );
  assert.equal(
    getPuckEditorRouteParams({ segments: ['collections', 'pages', '1'] }),
    null,
  );
});

test('the editor and public site register the same renderer for every Onda 1 block', () => {
  for (const type of Object.keys(blockRegistry)) {
    const editorRenderer = editorConfig.components[type as keyof typeof editorConfig.components]?.render;
    const siteRenderer = renderConfig.components[type as keyof typeof renderConfig.components]?.render;
    assert.ok(editorRenderer, `${type} must be registered in the editor.`);
    assert.ok(siteRenderer, `${type} must be registered for public rendering.`);
    assert.strictEqual(siteRenderer, editorRenderer, `${type} must share the exact render component.`);
  }
});

test('media URLs saved to Puck data are site-relative and never retain a host', () => {
  assert.equal(
    toRelativeImageUrl('/api/media/file/foto.jpg', 'https://cms.example.test'),
    '/api/media/file/foto.jpg',
  );
  assert.equal(
    toRelativeImageUrl('https://cms.example.test/api/media/file/foto.jpg?size=large', 'https://cms.example.test'),
    '/api/media/file/foto.jpg?size=large',
  );
  assert.equal(
    toRelativeImageUrl('https://cdn.example.test/foto.jpg', 'https://cms.example.test'),
    null,
  );
});

test('blank and services page templates pass the server-side Puck validation', () => {
  for (const [id, template] of Object.entries(pageTemplates)) {
    assert.doesNotThrow(
      () => validatePuckDataForPages(template.data),
      `The ${id} page template must pass the same Zod validation used by pages.`,
    );
  }
});

test('configured authentication and uploads have explicit security limits', () => {
  assert.equal(isStrongPayloadSecret('replace-with-an-example-that-is-long-enough'), false);
  assert.equal(
    isStrongPayloadSecret(randomBytes(48).toString('base64url')),
    true,
  );
});

type TestUser = {
  collection: 'users';
  createdAt: string;
  email: string;
  id: number;
  name: string;
  role: 'admin' | 'editor';
  updatedAt: string;
};

type JSONValue = boolean | null | number | string | JSONValue[] | { [key: string]: JSONValue };

function hasStatus(error: unknown, status: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === status
  );
}

async function resetPayloadTestSchema(pool: Pool): Promise<void> {
  await pool.query('CREATE SCHEMA IF NOT EXISTS "payload_test"');
  const schemaTables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'payload_test' AND table_type = 'BASE TABLE' ORDER BY table_name",
  );

  if (schemaTables.rowCount === 0) {
    return;
  }

  const tableNames = schemaTables.rows
    .map((row) => `"payload_test"."${row.table_name}"`)
    .join(', ');

  await pool.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
}

async function assertForbidden(operation: Promise<unknown>): Promise<void> {
  await assert.rejects(operation, (error: unknown) => hasStatus(error, 403));
}

async function assertNoDocuments(
  operation: Promise<{ docs: unknown[] }>,
): Promise<void> {
  try {
    const result = await operation;
    assert.equal(result.docs.length, 0);
  } catch (error) {
    assert.ok(hasStatus(error, 403) || hasStatus(error, 404));
  }
}

test('Local API enforces the visitor/editor/admin access matrix in payload_test', async (t: TestContext) => {
  const connectionString =
    process.env.PAYLOAD_TEST_DATABASE_URI ?? process.env.DATABASE_URI;
  assert.ok(
    connectionString,
    'Set PAYLOAD_TEST_DATABASE_URI or DATABASE_URI to run integration tests.',
  );

  const tempDir = await mkdtemp(join(tmpdir(), 'payload-access-integration-'));
  const uploadDir = join(tempDir, 'uploads');
  await mkdir(uploadDir);
  process.env.PAYLOAD_TEST_UPLOAD_DIR = uploadDir;

  const schemaPool = new Pool({ connectionString });
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined;
  let schemaPoolOpen = true;
  const createdPages: Array<number | string> = [];
  const createdMedia: Array<number | string> = [];
  const createdUsers: Array<number | string> = [];

  try {
    await resetPayloadTestSchema(schemaPool);
    await schemaPool.end();
    schemaPoolOpen = false;

    const { default: config } = await import('../payload.config');
    const activePayload = await getPayload({
      config,
      key: 'access-integration-test',
    });
    payload = activePayload;
    assert.equal(activePayload.db.schemaName, 'payload_test');
    const usersConfig = activePayload.config.collections.find(
      (collection) => collection.slug === 'users',
    );
    const mediaConfig = activePayload.config.collections.find(
      (collection) => collection.slug === 'media',
    );
    const pagesConfig = activePayload.config.collections.find(
      (collection) => collection.slug === 'pages',
    );
    assert.equal(usersConfig?.auth?.maxLoginAttempts, 5);
    assert.equal(usersConfig?.auth?.lockTime, 10 * 60 * 1000);
    assert.equal(pagesConfig?.versions?.maxPerDoc, 20);
    assert.deepEqual(activePayload.config.cors, []);
    assert.deepEqual(activePayload.config.csrf, []);
    assert.deepEqual(mediaConfig?.upload?.mimeTypes, [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
    ]);
    assert.equal(activePayload.config.upload?.limits?.fileSize, 5 * 1024 * 1024);
    assert.equal(activePayload.config.upload?.requestSizeLimit, 6 * 1024 * 1024);

    const runId = randomUUID();
    const randomPassword = () => randomBytes(32).toString('base64url');
    const createUser = async (
      name: string,
      role: 'admin' | 'editor',
    ): Promise<TestUser> => {
      const user = await activePayload.create({
        collection: 'users',
        data: {
          email: `${runId}-${name}@example.test`,
          name,
          password: randomPassword(),
          role,
        },
        overrideAccess: true,
        context: disableRevalidation,
      });
      createdUsers.push(user.id);
      return {
        ...user,
        collection: 'users',
      };
    };

    const admin = await createUser('admin', 'editor');
    assert.equal(admin.role, 'admin', 'The first unauthenticated user must be promoted.');

    const editor = await createUser('editor', 'editor');
    assert.equal(editor.role, 'editor', 'Later users must keep the editor default.');

    const mediaImage = await sharp({
      create: {
        background: '#336699',
        channels: 3,
        height: 2,
        width: 2,
      },
    })
      .png()
      .toBuffer();
    const mediaFilePath = join(tempDir, 'integration-image.png');
    await writeFile(mediaFilePath, mediaImage);

    const createMedia = async (
      user?: TestUser,
    ): Promise<{ id: number | string; alt?: string; url?: string | null }> => {
      const media = await activePayload.create({
        collection: 'media',
        data: { alt: `Imagem ${randomUUID()}` },
        filePath: mediaFilePath,
        overrideAccess: false,
        user,
        context: disableRevalidation,
      });
      createdMedia.push(media.id);
      return media;
    };

    const publicPage = await payload.create({
      collection: 'pages',
      data: { title: `Publicado ${runId}`, _status: 'published' },
      overrideAccess: true,
      context: disableRevalidation,
    });
    createdPages.push(publicPage.id);
    assert.equal(publicPage._status, 'published');

    const draftPage = await payload.create({
      collection: 'pages',
      data: { title: `Rascunho ${runId}` },
      draft: true,
      overrideAccess: true,
      context: disableRevalidation,
    });
    createdPages.push(draftPage.id);

    await assertForbidden(
      payload.create({
        collection: 'pages',
        data: { title: `Visitante ${runId}` },
        draft: true,
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );

    const editorPage = await payload.create({
      collection: 'pages',
      data: { title: `Criada por editor ${runId}` },
      draft: true,
      overrideAccess: false,
      user: editor,
      context: disableRevalidation,
    });
    createdPages.push(editorPage.id);

    await t.test('draft autosaves create versions without exceeding the configured per-page limit', async (t) => {
      const versionPage = await activePayload.create({
        collection: 'pages',
        data: { title: `Medição de versões ${runId}` },
        draft: true,
        overrideAccess: false,
        user: editor,
        context: disableRevalidation,
      });
      createdPages.push(versionPage.id);

      const versionPool = new Pool({ connectionString });
      try {
        const countVersions = async () => {
          const result = await versionPool.query(
            'SELECT count(*)::int AS count FROM "payload_test"."_pages_v" WHERE parent_id = $1',
            [versionPage.id],
          );
          return result.rows[0].count as number;
        };

        const versionsBefore = await countVersions();
        for (let index = 1; index <= 5; index += 1) {
          await activePayload.update({
            collection: 'pages',
            id: versionPage.id,
            data: {
              puckData: {
                content: [{
                  type: 'Heading',
                  props: { level: 'h2', text: `Salvamento automático ${index}` },
                }],
                root: {},
                zones: {},
              },
            },
            draft: true,
            overrideAccess: false,
            user: editor,
            context: disableRevalidation,
          });
        }

        assert.equal(
          await countVersions() - versionsBefore,
          5,
          'Each of the first five draft saves must add one row to _pages_v.',
        );

        for (let index = 6; index <= 21; index += 1) {
          await activePayload.update({
            collection: 'pages',
            id: versionPage.id,
            data: {
              puckData: {
                content: [{
                  type: 'Heading',
                  props: { level: 'h2', text: `Salvamento automático ${index}` },
                }],
                root: {},
                zones: {},
              },
            },
            draft: true,
            overrideAccess: false,
            user: editor,
            context: disableRevalidation,
          });
        }

        const versionsAfter = await countVersions();
        const netGrowth = versionsAfter - versionsBefore;
        t.diagnostic(
          `Retained ${versionsAfter} total _pages_v rows after 21 draft saves (net growth ${netGrowth}); configured maximum is 20.`,
        );
        assert.ok(
          versionsAfter <= 20,
          'The document must retain no more than the configured 20 versions.',
        );
        assert.ok(versionsAfter > 0, 'The document must retain its latest versions.');
      } finally {
        await versionPool.end();
      }
    });

    await t.test('creating a page from a template saves a unique draft for its editor', async () => {
      const title = `Serviços ${runId}`;
      const createdFromTemplate = await activePayload.create({
        collection: 'pages',
        data: {
          _status: 'draft',
          puckData: structuredClone(pageTemplates.services.data),
          title,
        },
        draft: true,
        overrideAccess: false,
        user: editor,
        context: disableRevalidation,
      });
      createdPages.push(createdFromTemplate.id);

      const createdWithSameTitle = await activePayload.create({
        collection: 'pages',
        data: {
          _status: 'draft',
          puckData: structuredClone(pageTemplates.blank.data),
          title,
        },
        draft: true,
        overrideAccess: false,
        user: editor,
        context: disableRevalidation,
      });
      createdPages.push(createdWithSameTitle.id);

      assert.equal(createdFromTemplate._status, 'draft');
      assert.equal(createdFromTemplate.title, title);
      assert.equal(createdFromTemplate.slug, `servicos-${runId}`);
      assert.equal(createdWithSameTitle._status, 'draft');
      assert.equal(createdWithSameTitle.slug, `servicos-${runId}-2`);

      try {
        await activePayload.update({
          collection: 'pages',
          id: createdWithSameTitle.id,
          data: { slug: 'slug-alterado-pelo-editor' },
          draft: true,
          overrideAccess: false,
          user: editor,
          context: disableRevalidation,
        });
      } catch (error) {
        assert.ok(hasStatus(error, 403));
      }

      const reloadedPage = await activePayload.findByID({
        collection: 'pages',
        id: createdWithSameTitle.id,
        draft: true,
        overrideAccess: true,
        context: disableRevalidation,
      });
      assert.equal(
        reloadedPage.slug,
        `servicos-${runId}-2`,
        'Editors must not be able to change the generated page address.',
      );
    });

    await t.test('the visual editor requires an authenticated page editor', async () => {
      const visitorReq = await createLocalReq(
        { context: disableRevalidation },
        activePayload,
      );
      assert.equal(
        await findEditablePage({
          collection: 'pages',
          id: String(editorPage.id),
          payload: activePayload,
          req: visitorReq,
        }),
        null,
        'Visitors must not access the editor view.',
      );

      const editorReq = await createLocalReq(
        { context: disableRevalidation, user: editor },
        activePayload,
      );
      assert.equal(
        await findEditablePage({
          collection: 'media',
          id: String(editorPage.id),
          payload: activePayload,
          req: editorReq,
        }),
        null,
        'The editor view must reject collections outside pages.',
      );

      const editablePage = await findEditablePage({
        collection: 'pages',
        id: String(editorPage.id),
        payload: activePayload,
        req: editorReq,
      });
      assert.equal(editablePage?.id, editorPage.id);

      const pagesConfig = activePayload.collections.pages.config;
      const originalUpdateAccess = pagesConfig.access?.update;
      pagesConfig.access = {
        ...pagesConfig.access,
        update: () => false,
      };
      try {
        assert.equal(
          await findEditablePage({
            collection: 'pages',
            id: String(editorPage.id),
            payload: activePayload,
            req: editorReq,
          }),
          null,
          'Authenticated users without document update permission must not access the editor.',
        );
      } finally {
        pagesConfig.access = {
          ...pagesConfig.access,
          update: originalUpdateAccess,
        };
      }
    });

    const editorPageUpdate = await payload.update({
      collection: 'pages',
      id: editorPage.id,
      data: { title: `Editada por editor ${runId}` },
      overrideAccess: false,
      user: editor,
      context: disableRevalidation,
    });
    assert.equal(editorPageUpdate.title, `Editada por editor ${runId}`);

    await assertForbidden(
      payload.update({
        collection: 'pages',
        id: publicPage.id,
        data: { title: 'Alteração por visitante' },
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );

    await t.test('public reads return published pages only', async () => {
      const publicPages = await activePayload.find({
        collection: 'pages',
        where: { id: { in: [publicPage.id, draftPage.id] } },
        draft: false,
        limit: 10,
        overrideAccess: false,
        context: disableRevalidation,
      });
      assert.deepEqual(
        publicPages.docs.map((page) => page.id),
        [publicPage.id],
        'Visitors must only read published pages.',
      );
    });

    const editorDraft = await payload.findByID({
      collection: 'pages',
      id: draftPage.id,
      draft: true,
      overrideAccess: false,
      user: editor,
      context: disableRevalidation,
    });
    assert.equal(editorDraft.id, draftPage.id);

    const adminDraft = await payload.findByID({
      collection: 'pages',
      id: draftPage.id,
      draft: true,
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    assert.equal(adminDraft.id, draftPage.id);

    await assertNoDocuments(
      payload.find({
        collection: 'pages',
        where: { id: { equals: draftPage.id } },
        draft: true,
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );

    const editorSlugAttempt = await payload.update({
      collection: 'pages',
      id: publicPage.id,
      data: { slug: `editor-attempt-${runId}` },
      overrideAccess: false,
      user: editor,
      context: disableRevalidation,
    });
    assert.equal(editorSlugAttempt.slug, publicPage.slug);

    const titleEditedAfterPublish = await payload.update({
      collection: 'pages',
      id: publicPage.id,
      data: { title: `Título alterado ${runId}` },
      overrideAccess: false,
      user: editor,
      context: disableRevalidation,
    });
    assert.equal(
      titleEditedAfterPublish.slug,
      publicPage.slug,
      'Changing the title of a published page must preserve its slug.',
    );

    const editorPublishTarget = await payload.create({
      collection: 'pages',
      data: { title: `Publicável pelo editor ${runId}` },
      draft: true,
      overrideAccess: true,
      context: disableRevalidation,
    });
    createdPages.push(editorPublishTarget.id);
    const publishedByEditor = await payload.update({
      collection: 'pages',
      id: editorPublishTarget.id,
      data: { _status: 'published' },
      draft: false,
      overrideAccess: false,
      user: editor,
      context: disableRevalidation,
    });
    assert.equal(publishedByEditor._status, 'published');

    const adminVersions = await payload.findVersions({
      collection: 'pages',
      limit: 20,
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    assert.ok(adminVersions.totalDocs > 0, 'Admins may read page versions.');
    await assertNoDocuments(
      payload.findVersions({
        collection: 'pages',
        limit: 20,
        overrideAccess: false,
        user: editor,
        context: disableRevalidation,
      }),
    );
    await assertNoDocuments(
      payload.findVersions({
        collection: 'pages',
        limit: 20,
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );

    const editorDeleteDraft = await payload.create({
      collection: 'pages',
      data: { title: `Rascunho removível ${runId}` },
      draft: true,
      overrideAccess: true,
      context: disableRevalidation,
    });
    createdPages.push(editorDeleteDraft.id);
    await payload.delete({
      collection: 'pages',
      id: editorDeleteDraft.id,
      overrideAccess: false,
      user: editor,
      context: disableRevalidation,
    });
    createdPages.splice(createdPages.indexOf(editorDeleteDraft.id), 1);

    await assertForbidden(
      payload.delete({
        collection: 'pages',
        id: publicPage.id,
        overrideAccess: false,
        user: editor,
        context: disableRevalidation,
      }),
    );
    await assertForbidden(
      payload.delete({
        collection: 'pages',
        id: draftPage.id,
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );

    const adminPage = await payload.create({
      collection: 'pages',
      data: { title: `Página admin ${runId}`, _status: 'published' },
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    createdPages.push(adminPage.id);

    const adminSlugUpdate = await payload.update({
      collection: 'pages',
      id: adminPage.id,
      data: { slug: `slug-admin-${runId}` },
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    assert.equal(adminSlugUpdate.slug, `slug-admin-${runId}`);

    const editorMedia = await createMedia(editor);
    assert.ok(editorMedia.url, 'Payload must return a URL for uploaded media.');
    assert.match(editorMedia.url, /^\/api\/media\/file\//);
    assert.equal(
      toRelativeImageUrl(editorMedia.url, 'http://localhost:3000'),
      editorMedia.url,
      'The URL stored in Puck data must not include a host.',
    );
    const adminMedia = await createMedia(admin);

    const publicMedia = await payload.find({
      collection: 'media',
      where: { id: { in: [editorMedia.id, adminMedia.id] } },
      limit: 10,
      overrideAccess: false,
      context: disableRevalidation,
    });
    assert.equal(publicMedia.docs.length, 2, 'Media reads must be public.');

    await assertForbidden(
      payload.create({
        collection: 'media',
        data: { alt: 'Upload por visitante' },
        filePath: mediaFilePath,
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );

    const updatedMedia = await payload.update({
      collection: 'media',
      id: editorMedia.id,
      data: { alt: 'Editada pelo editor' },
      overrideAccess: false,
      user: editor,
      context: disableRevalidation,
    });
    assert.equal(updatedMedia.alt, 'Editada pelo editor');

    await assertForbidden(
      payload.update({
        collection: 'media',
        id: editorMedia.id,
        data: { alt: 'Alteração por visitante' },
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );
    await assertForbidden(
      payload.delete({
        collection: 'media',
        id: editorMedia.id,
        overrideAccess: false,
        user: editor,
        context: disableRevalidation,
      }),
    );
    await assertForbidden(
      payload.delete({
        collection: 'media',
        id: editorMedia.id,
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );

    const adminMediaUpdate = await payload.update({
      collection: 'media',
      id: adminMedia.id,
      data: { alt: 'Editada pelo admin' },
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    assert.equal(adminMediaUpdate.alt, 'Editada pelo admin');

    const managedUser = await payload.create({
      collection: 'users',
      data: {
        email: `${runId}-managed@example.test`,
        name: 'Usuário gerenciado',
        password: randomPassword(),
        role: 'editor',
      },
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    createdUsers.push(managedUser.id);

    const adminUsers = await payload.find({
      collection: 'users',
      limit: 20,
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    assert.ok(adminUsers.docs.some((user) => user.id === managedUser.id));

    await assertNoDocuments(
      payload.find({
        collection: 'users',
        limit: 20,
        overrideAccess: false,
        user: editor,
        context: disableRevalidation,
      }),
    );
    await assertNoDocuments(
      payload.find({
        collection: 'users',
        limit: 20,
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );

    await assertForbidden(
      payload.create({
        collection: 'users',
        data: {
          email: `${runId}-visitor@example.test`,
          name: 'Visitante',
          password: randomPassword(),
          role: 'editor',
        },
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );
    await assertForbidden(
      payload.create({
        collection: 'users',
        data: {
          email: `${runId}-editor@example.test`,
          name: 'Editor',
          password: randomPassword(),
          role: 'editor',
        },
        overrideAccess: false,
        user: editor,
        context: disableRevalidation,
      }),
    );
    await assertForbidden(
      payload.update({
        collection: 'users',
        id: managedUser.id,
        data: { role: 'admin' },
        overrideAccess: false,
        user: editor,
        context: disableRevalidation,
      }),
    );
    await assertForbidden(
      payload.update({
        collection: 'users',
        id: managedUser.id,
        data: { name: 'Alteração por visitante' },
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );
    await assertForbidden(
      payload.delete({
        collection: 'users',
        id: managedUser.id,
        overrideAccess: false,
        user: editor,
        context: disableRevalidation,
      }),
    );
    await assertForbidden(
      payload.delete({
        collection: 'users',
        id: managedUser.id,
        overrideAccess: false,
        context: disableRevalidation,
      }),
    );

    const managedUserUpdate = await payload.update({
      collection: 'users',
      id: managedUser.id,
      data: { role: 'admin' },
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    assert.equal(managedUserUpdate.role, 'admin');

    await payload.delete({
      collection: 'users',
      id: managedUser.id,
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    createdUsers.splice(createdUsers.indexOf(managedUser.id), 1);

    await payload.delete({
      collection: 'media',
      id: adminMedia.id,
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    createdMedia.splice(createdMedia.indexOf(adminMedia.id), 1);

    await payload.delete({
      collection: 'pages',
      id: adminPage.id,
      overrideAccess: false,
      user: admin,
      context: disableRevalidation,
    });
    createdPages.splice(createdPages.indexOf(adminPage.id), 1);
  } finally {
    if (schemaPoolOpen) {
      await schemaPool.end();
    }

    try {
      if (payload) {
        for (const id of createdMedia) {
          await payload.delete({
            collection: 'media',
            id,
            overrideAccess: true,
            context: disableRevalidation,
          });
        }
        for (const id of createdPages) {
          await payload.delete({
            collection: 'pages',
            id,
            overrideAccess: true,
            context: disableRevalidation,
          });
        }
        for (const id of createdUsers) {
          await payload.delete({
            collection: 'users',
            id,
            overrideAccess: true,
            context: disableRevalidation,
          });
        }
      }
    } finally {
      try {
        if (payload) {
          await payload.destroy();
        }
      } finally {
        await rm(tempDir, { force: true, recursive: true });
      }
    }
  }
});

test('Puck validation rejects unsafe content in drafts and publications and generates unique slugs in payload_test', async (t: TestContext) => {
  const connectionString =
    process.env.PAYLOAD_TEST_DATABASE_URI ?? process.env.DATABASE_URI;
  assert.ok(
    connectionString,
    'Set PAYLOAD_TEST_DATABASE_URI or DATABASE_URI to run Puck validation tests.',
  );

  const tempDir = await mkdtemp(join(tmpdir(), 'payload-puck-validation-'));
  const uploadDir = join(tempDir, 'uploads');
  await mkdir(uploadDir);
  process.env.PAYLOAD_TEST_UPLOAD_DIR = uploadDir;

  const schemaPool = new Pool({ connectionString });
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined;
  let schemaPoolOpen = true;
  const createdPages: Array<number | string> = [];

  try {
    await resetPayloadTestSchema(schemaPool);
    await schemaPool.end();
    schemaPoolOpen = false;

    const { default: config } = await import('../payload.config');
    payload = await getPayload({ config, key: 'puck-validation-test' });
    assert.equal(payload.db.schemaName, 'payload_test');

    const runId = randomUUID();
    const admin = await payload.create({
      collection: 'users',
      data: {
        email: `${runId}-puck-admin@example.test`,
        name: 'Admin validador',
        password: randomBytes(32).toString('base64url'),
        role: 'admin',
      },
      overrideAccess: true,
      context: disableRevalidation,
    });

    await t.test('invalid JSON, unknown blocks, oversized data, and unsafe URLs fail for drafts and publishing', async () => {
      const invalidPayloads: Array<{ label: string; value: JSONValue }> = [
        { label: 'JSON inválido', value: 'texto sem formato' },
        {
          label: 'bloco desconhecido',
          value: {
            content: [{ type: 'Unsupported', props: { text: 'desconhecido' } }],
            root: {},
            zones: {},
          },
        },
        {
          label: 'payload acima do limite',
          value: {
            content: [{ type: 'Text', props: { text: 'x'.repeat(300_000) } }],
            root: {},
            zones: {},
          },
        },
        {
          label: 'link javascript',
          value: {
            content: [{ type: 'Button', props: { label: 'Abrir', url: 'javascript:alert(1)' } }],
            root: {},
            zones: {},
          },
        },
        {
          label: 'imagem data URL',
          value: {
            content: [{
              type: 'Image',
              props: {
                image: {
                  alt: 'Inválida',
                  height: 20,
                  id: 1,
                  url: 'data:image/png;base64,AAAA',
                  width: 20,
                },
              },
            }],
            root: {},
            zones: {},
          },
        },
      ];

      for (const invalid of invalidPayloads) {
        await assert.rejects(
          payload!.create({
            collection: 'pages',
            data: { title: `${invalid.label} rascunho ${runId}`, puckData: invalid.value },
            draft: true,
            overrideAccess: true,
            user: admin,
            context: disableRevalidation,
          }),
          (error: unknown) => hasStatus(error, 400),
          `${invalid.label} must be rejected in a draft.`,
        );

        const publishTarget = await payload!.create({
          collection: 'pages',
          data: {
            title: `${invalid.label} publicado ${runId}`,
            _status: 'published',
            puckData: {
              content: [{ type: 'Heading', props: { level: 'h2', text: 'Válida' } }],
              root: {},
              zones: {},
            },
          },
          draft: false,
          overrideAccess: true,
          user: admin,
          context: disableRevalidation,
        });
        createdPages.push(publishTarget.id);

        await assert.rejects(
          payload!.update({
            collection: 'pages',
            id: publishTarget.id,
            data: { _status: 'published', puckData: invalid.value },
            draft: false,
            overrideAccess: true,
            user: admin,
            context: disableRevalidation,
          }),
          (error: unknown) => hasStatus(error, 400),
          `${invalid.label} must be rejected while publishing.`,
        );
      }
    });

    await t.test('URL sanitizers accept supported schemes and reject unsafe schemes', () => {
      assert.equal(sanitizeLinkUrl('/pagina'), '/pagina');
      assert.equal(sanitizeLinkUrl('https://example.test'), 'https://example.test');
      assert.equal(sanitizeLinkUrl('mailto:oi@example.test'), 'mailto:oi@example.test');
      assert.equal(sanitizeLinkUrl('tel:+5511999999999'), 'tel:+5511999999999');
      assert.equal(sanitizeLinkUrl('javascript:alert(1)'), null);
      assert.equal(sanitizeLinkUrl('data:text/html,teste'), null);
      assert.equal(sanitizeImageUrl('data:image/png;base64,AAAA'), null);
      assert.equal(sanitizeImageUrl('//example.test/image.png'), null);
    });

    await t.test('accepts all seven Onda 1 blocks, including nested CardGrid media', async () => {
      const ondaOnePage = await payload!.create({
        collection: 'pages',
        data: {
          title: `Blocos Onda 1 ${runId}`,
          puckData: {
            content: [
              { type: 'Banner', props: { title: 'Banner', buttonUrl: '/contato', backgroundImage: null } },
              {
                type: 'CardGrid',
                props: {
                  columns: '3',
                  cards: [{
                    title: 'Card',
                    text: 'Descrição',
                    url: 'https://example.test',
                    image: {
                      id: 42,
                      url: '/media/card.png',
                      alt: 'Imagem do card',
                      width: 900,
                      height: 600,
                    },
                  }],
                },
              },
              { type: 'Heading', props: { text: 'Título', level: 'h2' } },
              { type: 'Text', props: { text: 'Parágrafo', align: 'left' } },
              {
                type: 'Image',
                props: {
                  image: {
                    id: 43,
                    url: '/media/foto.png',
                    alt: 'Foto',
                    width: 1200,
                    height: 800,
                  },
                  caption: 'Legenda',
                },
              },
              { type: 'Button', props: { label: 'Abrir', url: 'mailto:oi@example.test', style: 'primário' } },
              { type: 'Spacer', props: { size: 'médio' } },
            ],
            root: {},
            zones: {},
          },
        },
        draft: true,
        overrideAccess: true,
        user: admin,
        context: disableRevalidation,
      });
      createdPages.push(ondaOnePage.id);
      assert.equal(ondaOnePage._status, 'draft');
    });

    const draftOne = await payload!.create({
      collection: 'pages',
      data: {
        title: `Rascunho único ${runId}`,
        puckData: {
          content: [{ type: 'Heading', props: { text: 'Cabecalho', level: 'h2' } }],
          root: {},
          zones: {},
        },
      },
      draft: true,
      overrideAccess: true,
      user: admin,
      context: disableRevalidation,
    });
    createdPages.push(draftOne.id);

    const draftTwo = await payload!.create({
      collection: 'pages',
      data: {
        title: `Rascunho único ${runId}`,
        puckData: {
          content: [{ type: 'Text', props: { text: 'Texto alternativo' } }],
          root: {},
          zones: {},
        },
      },
      draft: true,
      overrideAccess: true,
      user: admin,
      context: disableRevalidation,
    });
    createdPages.push(draftTwo.id);

    assert.notEqual(draftOne.slug, draftTwo.slug, 'Draft titles must generate unique slugs.');
    assert.equal(draftOne._status, 'draft');
    assert.equal(draftTwo._status, 'draft');
  } finally {
    if (schemaPoolOpen) {
      await schemaPool.end();
    }

    try {
      if (payload) {
        for (const id of createdPages) {
          await payload.delete({
            collection: 'pages',
            id,
            overrideAccess: true,
            context: disableRevalidation,
          });
        }
      }
    } finally {
      try {
        if (payload) {
          await payload.destroy();
        }
      } finally {
        await rm(tempDir, { force: true, recursive: true });
      }
    }
  }
});
