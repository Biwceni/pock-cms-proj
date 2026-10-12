import assert from 'node:assert/strict';
import { test } from 'node:test';

const baseURL = process.env.PUCK_EDITOR_TEST_BASE_URL ?? 'http://localhost:3000';
const email = process.env.PUCK_EDITOR_TEST_EMAIL;
const password = process.env.PUCK_EDITOR_TEST_PASSWORD;
const pageID = process.env.PUCK_EDITOR_TEST_PAGE_ID;
const adminEmail = process.env.PUCK_EDITOR_TEST_ADMIN_EMAIL;
const adminPassword = process.env.PUCK_EDITOR_TEST_ADMIN_PASSWORD;
const editorEmail = process.env.PUCK_EDITOR_TEST_EDITOR_EMAIL;
const editorPassword = process.env.PUCK_EDITOR_TEST_EDITOR_PASSWORD;
const createdPageIDs = [];

async function loginAs(userEmail, userPassword) {
  const response = await fetch(`${baseURL}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: userEmail, password: userPassword }),
    redirect: 'manual',
  });
  assert.equal(response.status, 200, 'Payload REST login must succeed.');
  const setCookies = response.headers.getSetCookie();
  assert.ok(setCookies.length > 0, 'Payload REST login must issue a session cookie.');
  return setCookies.map((value) => value.split(';', 1)[0]).join('; ');
}

test('Payload visual editor route enforces authentication and renders authorized pages', async () => {
  assert.ok(email, 'Set PUCK_EDITOR_TEST_EMAIL to an existing Payload user.');
  assert.ok(password, 'Set PUCK_EDITOR_TEST_PASSWORD for that Payload user.');
  assert.ok(pageID, 'Set PUCK_EDITOR_TEST_PAGE_ID to an existing page ID.');

  const routeURL = `${baseURL}/admin/puck-editor/pages/${encodeURIComponent(pageID)}`;
  const anonymousResponse = await fetch(routeURL, { redirect: 'manual' });
  if (anonymousResponse.status >= 300 && anonymousResponse.status < 400) {
    assert.match(
      anonymousResponse.headers.get('location') ?? '',
      /\/admin\/login/,
      'Anonymous users must be redirected to the Payload login.',
    );
  } else {
    assert.equal(
      anonymousResponse.status,
      200,
      'Anonymous users must receive the Payload login view.',
    );
    const anonymousHTML = await anonymousResponse.text();
    assert.match(anonymousHTML, /Email/);
    assert.doesNotMatch(anonymousHTML, /Editor visual:/);
  }

  const anonymousNewPage = await fetch(`${baseURL}/admin/nova-pagina`, {
    redirect: 'manual',
  });
  const anonymousNewPageHTML =
    anonymousNewPage.status === 200 ? await anonymousNewPage.text() : '';
  assert.ok(
    (anonymousNewPage.status >= 300 &&
      anonymousNewPage.status < 400 &&
      /\/admin\/login/.test(anonymousNewPage.headers.get('location') ?? '')) ||
      (anonymousNewPage.status === 200 &&
        /Email/.test(anonymousNewPageHTML) &&
        !anonymousNewPageHTML.includes('Criar e abrir editor')),
    'Anonymous users must not access the new-page view.',
  );

  const cookie = await loginAs(email, password);

  const editorResponse = await fetch(routeURL, {
    headers: { cookie },
    redirect: 'manual',
  });
  const editorHTML = await editorResponse.text();
  assert.equal(
    editorResponse.status,
    200,
    `Authorized user must receive the editor, got ${editorResponse.status} ${editorResponse.headers.get('location') ?? ''}.`,
  );
  assert.match(editorHTML, /Editor visual:/);
  assert.match(editorHTML, /Salvar rascunho/);
  assert.match(editorHTML, /Publicar/);

  const unsupportedCollectionResponse = await fetch(
    `${baseURL}/admin/puck-editor/users/1`,
    {
      headers: { cookie },
      redirect: 'manual',
    },
  );
  assert.equal(
    unsupportedCollectionResponse.status,
    404,
    'Authenticated users must not open the visual editor for collections other than pages.',
  );
});

test(
  'editor and admin receive role-specific admin routes and editor controls',
  {
    skip: !adminEmail || !adminPassword || !editorEmail || !editorPassword || !pageID,
  },
  async () => {
    const adminCookie = await loginAs(adminEmail, adminPassword);
    const editorCookie = await loginAs(editorEmail, editorPassword);
    const editorHeaders = { cookie: editorCookie };
    const adminHeaders = { cookie: adminCookie };

    for (const [role, headers] of [
      ['editor', editorHeaders],
      ['admin', adminHeaders],
    ]) {
      const newPageView = await fetch(`${baseURL}/admin/nova-pagina`, {
        headers,
        redirect: 'manual',
      });
      assert.equal(newPageView.status, 200, `${role} must access the new-page view.`);
      const newPageHTML = await newPageView.text();
      assert.match(newPageHTML, /Título da página/);
      assert.match(newPageHTML, /Criar e abrir editor/);
      assert.match(newPageHTML, /Em branco/);
      assert.match(newPageHTML, /Serviços/);
    }

    for (const [role, headers] of [
      ['editor', editorHeaders],
      ['admin', adminHeaders],
    ]) {
      const editorRoute = await fetch(
        `${baseURL}/admin/puck-editor/pages/${encodeURIComponent(pageID)}`,
        { headers, redirect: 'manual' },
      );
      assert.equal(
        editorRoute.status,
        200,
        `${role} must access the Puck editor, got ${editorRoute.status} ${editorRoute.headers.get('location') ?? ''}.`,
      );
      const html = await editorRoute.text();
      assert.match(html, /Voltar para Páginas/);
      assert.match(html, /Publicar alterações/);
      assert.match(html, /Ver página no site|Salvar rascunho/);
    }

    const editorUsersRoute = await fetch(`${baseURL}/admin/collections/users`, {
      headers: editorHeaders,
      redirect: 'manual',
    });
    assert.equal(editorUsersRoute.status, 404, 'Editors must not open Users by URL.');

    const adminUsersRoute = await fetch(`${baseURL}/admin/collections/users`, {
      headers: adminHeaders,
      redirect: 'manual',
    });
    assert.equal(adminUsersRoute.status, 200, 'Admins must retain access to Users.');

    const editorVersions = await fetch(`${baseURL}/api/pages/versions?limit=10`, {
      headers: editorHeaders,
    });
    assert.ok(
      editorVersions.status === 403 ||
        (editorVersions.ok &&
          ((await editorVersions.json()).docs?.length ?? 0) === 0),
      'Editors must not read version records through the REST API.',
    );

    const adminHTML = await fetch(`${baseURL}/admin/collections/pages`, {
      headers: adminHeaders,
    }).then((response) => response.text());
    assert.match(adminHTML, /aria-label="Abrir API de páginas"/);

    const editorHTML = await fetch(`${baseURL}/admin/collections/pages`, {
      headers: editorHeaders,
    }).then((response) => response.text());
    assert.doesNotMatch(editorHTML, /aria-label="Abrir API de páginas"/);

    const duplicateTitle = `Página criada HTTP ${Date.now()}`;
    const createdSlugs = [];
    for (const title of [duplicateTitle, duplicateTitle]) {
      const createResponse = await fetch(`${baseURL}/api/pages?draft=true`, {
        method: 'POST',
        headers: { ...editorHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({
          _status: 'draft',
          puckData: { content: [], root: {}, zones: {} },
          title,
        }),
      });
      assert.equal(createResponse.status, 201, 'The editor must create a draft from the new-page flow.');
      const created = await createResponse.json();
      const page = created.doc ?? created;
      createdPageIDs.push(page.id);
      createdSlugs.push(page.slug);
      assert.equal(page._status, 'draft');
      assert.ok(page.slug, 'The page must receive its slug automatically.');

      const editorView = await fetch(
        `${baseURL}/admin/puck-editor/pages/${encodeURIComponent(String(page.id))}`,
        { headers: editorHeaders },
      );
      assert.equal(editorView.status, 200, 'Newly created page must open in the visual editor.');
      assert.match(await editorView.text(), /Editor visual:/);
    }

    assert.notEqual(
      createdSlugs[0],
      createdSlugs[1],
      'Pages created with the same title must have unique slugs.',
    );
  },
);

test.after(async () => {
  if (!adminEmail || !adminPassword) {
    return;
  }

  const cookie = await loginAs(adminEmail, adminPassword);
  for (const id of createdPageIDs) {
    await fetch(`${baseURL}/api/pages/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: { cookie },
    });
  }
});
