import type { CollectionConfig } from 'payload';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { pt } from '@payloadcms/translations/languages/pt';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import {
  canDeletePage,
  isAdmin,
  isAdminUser,
  isLoggedIn,
  publishedOrAuthenticated,
} from './src/access';
import { revalidatePageChange, revalidatePageDelete } from './src/lib/revalidate';
import { slugify } from './src/lib/slugify';
import { isStrongPayloadSecret } from './src/lib/security';
import { validatePuckDataForPages } from './src/lib/puck-validation';

const payloadSecret =
  process.env.NODE_ENV === 'test'
    ? randomBytes(48).toString('base64url')
    : process.env.PAYLOAD_SECRET;

if (!payloadSecret || !isStrongPayloadSecret(payloadSecret)) {
  throw new Error(
    'PAYLOAD_SECRET precisa ter pelo menos 32 caracteres aleatórios e não pode ser um valor de exemplo.',
  );
}

const databaseURI =
  process.env.NODE_ENV === 'test'
    ? process.env.PAYLOAD_TEST_DATABASE_URI ?? process.env.DATABASE_URI
    : process.env.DATABASE_URI;

if (!databaseURI) {
  throw new Error('DATABASE_URI (ou PAYLOAD_TEST_DATABASE_URI nos testes) é obrigatório.');
}

const users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Usuário',
    plural: 'Usuários',
  },
  auth: {
    verify: false,
    loginWithUsername: false,
    tokenExpiration: 60 * 60 * 24 * 7,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    cookies: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    },
  },
  admin: {
    useAsTitle: 'name',
    group: 'Configurações',
    hidden: ({ user }) => !isAdminUser(user),
  },
  access: {
    admin: isLoggedIn,
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation === 'create' && !req.user) {
          const { totalDocs } = await req.payload.count({
            collection: 'users',
            overrideAccess: true,
            req,
          });

          if (totalDocs === 0) {
            data.role = 'admin';
          }
        }

        return data;
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nome',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      label: 'Perfil',
      defaultValue: 'editor',
      access: {
        update: isAdmin,
      },
      options: [
        { label: 'Administrador', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      required: true,
    },
  ],
};

const media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Mídia',
    plural: 'Mídias',
  },
  admin: {
    useAsTitle: 'filename',
    group: 'Conteúdo',
    hideAPIURL: true,
  },
  access: {
    admin: isLoggedIn,
    create: isLoggedIn,
    read: () => true,
    update: isLoggedIn,
    delete: isAdmin,
  },
  upload: {
    staticDir:
      process.env.NODE_ENV === 'test' && process.env.PAYLOAD_TEST_UPLOAD_DIR
        ? process.env.PAYLOAD_TEST_UPLOAD_DIR
        : './public/uploads',
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
    imageSizes: [
      { name: 'thumbnail', width: 300, height: 300, fit: 'cover' },
      { name: 'large', width: 1200, height: 1200, fit: 'contain' },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Texto alternativo',
      admin: {
        description: 'Descreva a imagem para quem não consegue vê-la.',
      },
      required: true,
    },
  ],
};

const pages: CollectionConfig = {
  slug: 'pages',
  labels: {
    singular: 'Página',
    plural: 'Páginas',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'updatedAt'],
    group: 'Conteúdo',
    hideAPIURL: true,
  },
  versions: {
    maxPerDoc: 20,
    drafts: {
      autosave: false,
    },
  },
  access: {
    admin: isLoggedIn,
    create: isLoggedIn,
    read: publishedOrAuthenticated,
    update: isLoggedIn,
    delete: canDeletePage,
    readVersions: isAdmin,
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, originalDoc, req }) => {
        if (!data) {
          return data;
        }

        if (typeof data.puckData !== 'undefined' && data.puckData !== null) {
          validatePuckDataForPages(data.puckData);
        }

        if (typeof data.title !== 'string' || !data.title.trim()) {
          return data;
        }

        const titleChanged = operation === 'update' && data.title !== originalDoc?.title;
        const submittedSlug = typeof data.slug === 'string' ? data.slug.trim() : '';
        const submittedSlugChanged = Boolean(
          submittedSlug && submittedSlug !== originalDoc?.slug,
        );
        const publishedTitleChanged =
          originalDoc?._status === 'published' && titleChanged && !submittedSlugChanged;

        if (publishedTitleChanged) {
          data.slug = originalDoc.slug;
          return data;
        }

        const base = slugify(
          titleChanged && !submittedSlugChanged
            ? data.title
            : submittedSlug || data.title,
        );
        let uniqueSlug = base;
        let suffix = 2;

        while (true) {
          const found = await req.payload.find({
            collection: 'pages',
            where: {
              slug: {
                equals: uniqueSlug,
              },
            },
            draft: true,
            limit: 1,
            overrideAccess: true,
          });

          const currentID = originalDoc?.id ?? data.id;
          if (found.docs.length === 0 || found.docs.every((doc) => doc.id === currentID)) {
            break;
          }

          uniqueSlug = `${base}-${suffix}`;
          suffix += 1;
        }

        data.slug = uniqueSlug;
        return data;
      },
    ],
    afterChange: [revalidatePageChange],
    afterDelete: [revalidatePageDelete],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Endereço',
      index: true,
      unique: true,
      access: {
        update: isAdmin,
      },
      admin: {
        description: 'Gerado automaticamente a partir do título.',
        condition: (data, _siblingData, { user }) =>
          isAdminUser(user) && data.id !== undefined,
      },
    },
    {
      name: 'puckData',
      type: 'json',
      label: 'Conteúdo da página',
      admin: {
        components: {
          Field: '/src/components/PuckDataField#PuckDataField',
        },
      },
      defaultValue: {
        content: [],
        root: {},
        zones: {},
      },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'Aparência nos buscadores',
      fields: [
        {
          type: 'collapsible',
          label: 'Aparência nos buscadores',
          admin: {
            initCollapsed: true,
          },
          fields: [
            {
              name: 'metaTitle',
              type: 'text',
              label: 'Título para o Google',
            },
            {
              name: 'metaDescription',
              type: 'textarea',
              label: 'Descrição',
            },
            {
              name: 'metaImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Imagem de compartilhamento',
            },
          ],
        },
      ],
    },
  ],
};

export default buildConfig({
  secret: payloadSecret,
  sharp,
  cors: [],
  csrf: [],
  upload: {
    abortOnLimit: true,
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
    requestSizeLimit: 6 * 1024 * 1024,
    responseOnLimit: 'O arquivo excede o limite de 5 MB.',
  },
  admin: {
    user: 'users',
    components: {
      actions: [
        '/src/components/NewPageAction#NewPageAction',
        '/src/components/AdminAPIAction#AdminAPIAction',
      ],
      views: {
        newPage: {
          path: '/nova-pagina',
          Component: '/src/components/NewPageView#NewPageView',
        },
        puckEditor: {
          path: '/puck-editor/:collection/:id',
          Component: '/src/components/PuckEditorView#PuckEditorView',
        },
      },
    },
  },
  i18n: {
    fallbackLanguage: 'pt',
    supportedLanguages: {
      pt,
    },
    translations: {
      pt: {
        ...pt.translations,
        general: {
          ...pt.translations.general,
          aboutToDelete: 'Você está prestes a excluir {{label}} <1>{{title}}</1>. Deseja continuar?',
          creatingNewLabel: 'Criando: {{label}}',
          untitled: '[Sem título]',
        },
        version: {
          ...pt.translations.version,
          publishChanges: 'Publicar alterações',
        },
      },
    },
  },
  db: postgresAdapter({
    schemaName:
      process.env.NODE_ENV === 'test' ||
      process.env.PAYLOAD_SCHEMA_NAME === 'payload_test'
        ? 'payload_test'
        : 'payload',
    pool: {
      connectionString: databaseURI,
    },
  }),
  collections: [users, media, pages],
  typescript: {
    outputFile: './payload-types.ts',
  },
});
