import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { Data } from '@puckeditor/core';
import { Pool } from 'pg';
import { phaseTwoDraftData, phaseTwoPageData } from '../puck/sample-data';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const connectionString =
  process.env.PAYLOAD_TEST_DATABASE_URI ?? process.env.DATABASE_URI;

assert.ok(
  connectionString,
  'Set PAYLOAD_TEST_DATABASE_URI or DATABASE_URI for the isolated production smoke test.',
);

const port = Number(process.env.PHASE_2_TEST_PORT ?? 3100);
assert.ok(Number.isInteger(port) && port > 0 && port < 65536);

const database = new Pool({ connectionString });
const schemaTables = await database.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='payload_test' AND table_type='BASE TABLE'",
);

if (schemaTables.rows.some((row) => row.table_name === 'users')) {
  const counts = await database.query(
    'SELECT (SELECT count(*) FROM payload_test.users)::int AS users, (SELECT count(*) FROM payload_test.pages)::int AS pages',
  );
  assert.equal(counts.rows[0].users, 0, 'payload_test.users must be empty.');
  assert.equal(counts.rows[0].pages, 0, 'payload_test.pages must be empty.');
}

await database.end();

Object.assign(process.env, {
  NODE_ENV: 'production',
  PAYLOAD_SCHEMA_NAME: 'payload_test',
  DATABASE_URI: connectionString,
});

const uploadDir = await mkdtemp(join(tmpdir(), 'payload-phase-2-production-'));
Object.assign(process.env, { PAYLOAD_TEST_UPLOAD_DIR: uploadDir });

let server: ChildProcess | undefined;
let serverClosed: Promise<void> | undefined;
let token: string | undefined;
let userID: number | string | undefined;
const pageIDs: Array<number | string> = [];
const baseURL = `http://127.0.0.1:${port}`;

function startServer(): ChildProcess {
  const nextBin = join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '--port', String(port)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.resume();
  child.stderr?.resume();

  return child;
}

async function waitForServer(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('The production Next.js server exited before becoming ready.');
    }

    try {
      const response = await fetch(`${baseURL}/api/pages?limit=1`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error('The production Next.js server did not become ready within 60 seconds.');
}

async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<{ body: Record<string, unknown>; response: Response }> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `JWT ${token}`);
  }
  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${baseURL}${path}`, { ...options, headers });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Expected JSON from Payload API for ${path}.`);
    }
  }

  return { body, response };
}

async function createPage(args: {
  title: string;
  slug: string;
  puckData: Data;
  status: 'draft' | 'published';
}): Promise<number | string> {
  const { body, response } = await apiRequest('/api/pages', {
    method: 'POST',
    body: JSON.stringify({
      title: args.title,
      slug: args.slug,
      puckData: args.puckData,
      seo: {
        metaTitle: `SEO ${args.title}`,
        metaDescription: `Descrição SEO ${args.title}`,
      },
      _status: args.status,
    }),
  });
  assert.equal(response.status, 201, `Could not create the ${args.status} fixture.`);

  const doc = (body.doc ?? body) as { id?: number | string };
  assert.ok(doc.id, `Payload did not return the ID of the ${args.status} fixture.`);
  pageIDs.push(doc.id);
  return doc.id;
}

async function assertPageStatus(path: string, expectedStatus: number): Promise<string> {
  const response = await fetch(`${baseURL}${path}`, { redirect: 'manual' });
  assert.equal(response.status, expectedStatus, `${path} returned an unexpected status.`);
  return response.text();
}

function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  serverClosed = new Promise((resolve, reject) => {
    child.once('exit', () => resolve());
    child.once('error', reject);
  });
  child.kill();
  return serverClosed;
}

try {
  server = startServer();
  await waitForServer(server);

  const runID = randomUUID();
  const email = `phase-2-${runID}@example.test`;
  const password = randomBytes(32).toString('base64url');
  const registration = await apiRequest('/api/users/first-register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      name: `Validador ${runID}`,
      password,
      role: 'editor',
    }),
  });
  assert.equal(registration.response.status, 200, 'Could not create a test admin.');
  assert.equal((registration.body.user as { role?: string })?.role, 'admin');
  token = registration.body.token as string;
  userID = (registration.body.user as { id?: number | string }).id;
  assert.ok(token && userID);

  const publishedTitle = `Página publicada ${runID}`;
  const publishedMetaTitle = `SEO ${publishedTitle}`;
  const publishedID = await createPage({
    title: publishedTitle,
    slug: 'home',
    puckData: phaseTwoPageData,
    status: 'published',
  });
  const draftSlug = `rascunho-${runID}`;
  await createPage({
    title: `Rascunho ${runID}`,
    slug: draftSlug,
    puckData: phaseTwoDraftData,
    status: 'draft',
  });
  const emptyContentSlug = `sem-conteudo-${runID}`;
  await createPage({
    title: `Sem conteúdo ${runID}`,
    slug: emptyContentSlug,
    puckData: { root: {}, content: [], zones: {} },
    status: 'published',
  });

  const publishedHTML = await assertPageStatus('/', 200);
  assert.ok(publishedHTML.includes('Site público da Fase 2'));
  assert.ok(publishedHTML.includes(publishedTitle));
  assert.ok(publishedHTML.includes(`<title>${publishedMetaTitle}</title>`));
  await assertPageStatus(`/${draftSlug}`, 404);
  await assertPageStatus(`/${emptyContentSlug}`, 404);

  const updatedSlug = `pagina-alterada-${runID}`;
  const slugUpdate = await apiRequest(`/api/pages/${publishedID}`, {
    method: 'PATCH',
    body: JSON.stringify({ slug: updatedSlug }),
  });
  assert.equal(slugUpdate.response.status, 200, 'Could not update the published slug.');
  await assertPageStatus('/', 404);
  const changedSlugHTML = await assertPageStatus(`/${updatedSlug}`, 200);
  assert.ok(changedSlugHTML.includes('Site público da Fase 2'));

  const unpublish = await apiRequest(`/api/pages/${publishedID}`, {
    method: 'PATCH',
    body: JSON.stringify({ _status: 'draft' }),
  });
  assert.equal(unpublish.response.status, 200, 'Could not unpublish the test page.');
  await assertPageStatus(`/${updatedSlug}`, 404);

  console.log(
    'Production smoke passed: published home, draft 404, slug revalidation, and unpublish revalidation.',
  );
} finally {
  const cleanupFailures: string[] = [];
  if (server && token) {
    for (const id of pageIDs) {
      const { response } = await apiRequest(`/api/pages/${id}`, {
        method: 'DELETE',
      }).catch(() => ({ response: undefined }));
      if (!response?.ok) {
        cleanupFailures.push(`Could not remove test page ${id} from payload_test.`);
      }
    }
    if (userID) {
      const { response } = await apiRequest(`/api/users/${userID}`, {
        method: 'DELETE',
      }).catch(() => ({ response: undefined }));
      if (!response?.ok) {
        cleanupFailures.push('Could not remove the test user from payload_test.');
      }
    }
  }

  if (server) {
    await stopServer(server);
    if (server.exitCode === null && server.signalCode === null) {
      cleanupFailures.push('Could not stop the production Next.js server.');
    }
  }

  await rm(uploadDir, { force: true, recursive: true });
  if (cleanupFailures.length > 0) {
    throw new Error(cleanupFailures.join(' '));
  }
}
