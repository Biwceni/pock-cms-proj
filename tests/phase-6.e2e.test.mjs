import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { test } from 'node:test';

const baseURL = process.env.PHASE6_E2E_BASE_URL ?? 'http://localhost:3000';
const email = process.env.PHASE6_E2E_EMAIL;
const password = process.env.PHASE6_E2E_PASSWORD;

test(
  'browser flow: login, create, publish, view, edit, and delete a page',
  { skip: !email || !password },
  async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    let pageID;

    try {
      await page.goto(`${baseURL}/admin/login`);
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Senha').fill(password);
      await page.getByRole('button', { name: 'Login' }).click();
      await page.waitForURL((url) => url.pathname === '/admin' || url.pathname.startsWith('/admin/collections'));
      const sessionCookie = (await context.cookies(baseURL)).find(
        (cookie) => cookie.name === 'payload-token',
      );
      assert.ok(sessionCookie, 'Payload login must create its standard session cookie.');
      assert.equal(sessionCookie.httpOnly, true);
      assert.equal(sessionCookie.secure, true);
      assert.equal(sessionCookie.sameSite, 'Strict');

      const svgStatus = await page.evaluate(async () => {
        const form = new FormData();
        form.append('_payload', JSON.stringify({ alt: 'SVG bloqueado' }));
        form.append(
          'file',
          new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'teste.svg', {
            type: 'image/svg+xml',
          }),
        );
        return (await fetch('/api/media', { method: 'POST', body: form })).status;
      });
      assert.ok(
        svgStatus === 400 || svgStatus === 415,
        `The media API must reject SVG files (received HTTP ${svgStatus}).`,
      );

      const oversizeStatus = await page.evaluate(async () => {
        const form = new FormData();
        form.append('_payload', JSON.stringify({ alt: 'Arquivo grande' }));
        form.append(
          'file',
          new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.png', {
            type: 'image/png',
          }),
        );
        return (await fetch('/api/media', { method: 'POST', body: form })).status;
      });
      assert.equal(oversizeStatus, 413, 'The media API must enforce the 5 MB upload limit.');

      await page.goto(`${baseURL}/admin/nova-pagina`);
      const title = `Teste Fase 6 ${randomUUID()}`;
      await page.getByLabel('Título da página').fill(title);
      await page.getByLabel('Modelo').selectOption('services');
      await page.getByRole('button', { name: 'Criar e abrir editor' }).click();
      await page.waitForURL(/\/admin\/puck-editor\/pages\/[^/]+$/);
      pageID = new URL(page.url()).pathname.split('/').at(-1);
      assert.ok(pageID);
      const puckHeader = page.getByTestId('puck-editor-header');
      await puckHeader.getByRole('button', { name: /Voltar para Páginas/ }).waitFor();
      await puckHeader.getByText(title, { exact: true }).waitFor();
      await puckHeader.getByText('Rascunho', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Publicar', exact: true }).count(), 1);
      assert.equal(
        await page.getByRole('button', { name: 'Publicar alterações', exact: true }).count(),
        0,
      );
      assert.equal(await page.locator('.app-header').count(), 0);
      assert.equal(await page.locator('.nav').count(), 0);
      assert.equal(await page.getByText('title', { exact: true }).count(), 0);

      if (process.env.PHASE6_E2E_SCREENSHOT_DIR) {
        await mkdir(process.env.PHASE6_E2E_SCREENSHOT_DIR, { recursive: true });
        for (const width of [1280, 768]) {
          await page.setViewportSize({ width, height: 900 });
          await page.screenshot({
            fullPage: false,
            path: join(process.env.PHASE6_E2E_SCREENSHOT_DIR, `puck-editor-${width}px.png`),
          });
        }
        await page.setViewportSize({ width: 1280, height: 900 });
      }

      const initial = await page.evaluate(async (id) => {
        const response = await fetch(
          `/api/pages/${encodeURIComponent(id)}?draft=true&depth=0`,
          { cache: 'no-store' },
        );
        return { status: response.status, body: await response.json() };
      }, pageID);
      assert.equal(initial.status, 200);
      const slug = initial.body.doc?.slug ?? initial.body.slug;
      assert.ok(slug);
      const initialData = initial.body.doc?.puckData ?? initial.body.puckData;
      assert.ok(initialData.content.length >= 4, 'The Services template must contain multiple Puck blocks.');

      await page.getByRole('button', { name: 'Publicar', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar publicação' }).click();
      await page.getByText('Publicada', { exact: true }).waitFor();

      const publicURL = slug === 'home' ? '/' : `/${encodeURIComponent(slug)}`;
      await page.goto(`${baseURL}${publicURL}`);
      await page.getByText('Nossos serviços', { exact: true }).waitFor();
      await page.getByText('Consultoria', { exact: true }).waitFor();

      const editedData = {
        ...initialData,
        content: initialData.content.map((block) =>
          block.type === 'Heading' && block.props.text === 'Nossos serviços'
            ? { ...block, props: { ...block.props, text: 'Serviços revisados' } }
            : block,
        ),
      };
      assert.ok(
        editedData.content.some(
          (block) => block.type === 'Heading' && block.props.text === 'Serviços revisados',
        ),
      );

      const draftStatus = await page.evaluate(async ({ data, id }) => {
        const response = await fetch(
          `/api/pages/${encodeURIComponent(id)}?draft=true`,
          {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _status: 'draft', puckData: data }),
          },
        );
        return response.status;
      }, { data: editedData, id: pageID });
      assert.equal(draftStatus, 200, 'Editing the published page must save as a draft.');

      await page.reload();
      await page.getByText('Nossos serviços', { exact: true }).waitFor();
      await page.getByText('Serviços revisados', { exact: true }).waitFor({ state: 'detached' });

      const publishStatus = await page.evaluate(async ({ data, id }) => {
        const response = await fetch(
          `/api/pages/${encodeURIComponent(id)}?draft=false`,
          {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _status: 'published', puckData: data }),
          },
        );
        return response.status;
      }, { data: editedData, id: pageID });
      assert.equal(publishStatus, 200);

      await page.reload();
      await page.getByText('Serviços revisados', { exact: true }).waitFor();

      const deleteStatus = await page.evaluate(async (id) => {
        const response = await fetch(
          `/api/pages/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        );
        return response.status;
      }, pageID);
      assert.equal(deleteStatus, 200, 'The administrator must be able to delete the published page.');

      const deletedResponse = await page.request.get(`${baseURL}${publicURL}`, {
        headers: { 'cache-control': 'no-store' },
      });
      assert.equal(deletedResponse.status(), 404, 'Deleting the page must remove it from the public site.');
      pageID = undefined;
    } finally {
      if (pageID) {
        await page.evaluate(async (id) => fetch(
          `/api/pages/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        ), pageID).catch(() => undefined);
      }
      await context.close();
      await browser.close();
    }
  },
);
