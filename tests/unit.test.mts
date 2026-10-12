import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { isAdminUser } from '../src/access';
import { slugify } from '../src/lib/slugify';
import { sanitizeImageUrl, sanitizeLinkUrl } from '../src/lib/puck-urls';
import { isStrongPayloadSecret } from '../src/lib/security';
import { validatePuckDataForPages } from '../src/lib/puck-validation';

test('slugify normalizes accents, punctuation, spaces, and empty titles', () => {
  assert.equal(slugify('  Serviços & Soluções  '), 'servicos-solucoes');
  assert.equal(slugify('Criação---de Páginas'), 'criacao-de-paginas');
  assert.equal(slugify('!!!'), 'pagina');
});

test('Puck Zod validation accepts known blocks and rejects malformed or unknown content', () => {
  assert.doesNotThrow(() =>
    validatePuckDataForPages({
      content: [{ type: 'Heading', props: { level: 'h2', text: 'Olá' } }],
      root: {},
      zones: {},
    }),
  );
  assert.throws(() =>
    validatePuckDataForPages({
      content: [{ type: 'RawHTML', props: { html: '<script>alert(1)</script>' } }],
      root: {},
      zones: {},
    }),
  );
  assert.throws(() => validatePuckDataForPages({ content: 'inválido' }));
});

test('access role helper distinguishes administrators', () => {
  assert.equal(isAdminUser({ role: 'admin' }), true);
  assert.equal(isAdminUser({ role: 'editor' }), false);
  assert.equal(isAdminUser(null), false);
});

test('URL sanitizers allow expected schemes and reject active or malformed URLs', () => {
  assert.equal(sanitizeLinkUrl('/sobre'), '/sobre');
  assert.equal(sanitizeLinkUrl('https://example.test/contato'), 'https://example.test/contato');
  assert.equal(sanitizeLinkUrl('mailto:ola@example.test'), 'mailto:ola@example.test');
  assert.equal(sanitizeLinkUrl('tel:+5511999999999'), 'tel:+5511999999999');
  assert.equal(sanitizeLinkUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeLinkUrl('data:text/html,abc'), null);
  assert.equal(sanitizeLinkUrl('//example.test'), null);
  assert.equal(sanitizeImageUrl('/api/media/file/foto.webp'), '/api/media/file/foto.webp');
  assert.equal(sanitizeImageUrl('data:image/svg+xml,abc'), null);
  assert.equal(sanitizeImageUrl('javascript:alert(1)'), null);
});

test('Payload secret validation rejects placeholders and accepts random secrets', () => {
  assert.equal(isStrongPayloadSecret(undefined), false);
  assert.equal(isStrongPayloadSecret('short'), false);
  assert.equal(isStrongPayloadSecret('replace-with-a-long-but-known-example-secret'), false);
  assert.equal(isStrongPayloadSecret(randomBytes(48).toString('base64url')), true);
});
