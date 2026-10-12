import type { Data } from '@puckeditor/core';

export const pageTemplates = {
  blank: {
    label: 'Em branco',
    description: 'Comece com uma página vazia.',
    data: {
      content: [],
      root: {},
      zones: {},
    },
  },
  services: {
    label: 'Serviços',
    description: 'Apresente seus serviços com um destaque e três cards.',
    data: {
      content: [
        {
          type: 'Banner',
          props: {
            id: 'services-banner',
            title: 'Como podemos ajudar?',
            subtitle: 'Conheça os serviços que preparamos para você.',
            buttonLabel: 'Fale com a gente',
            buttonUrl: '/contato',
            backgroundImage: null,
          },
        },
        {
          type: 'Heading',
          props: {
            id: 'services-heading',
            text: 'Nossos serviços',
            level: 'h2',
          },
        },
        {
          type: 'Text',
          props: {
            id: 'services-intro',
            text: 'Soluções pensadas para atender às suas necessidades.',
            align: 'left',
          },
        },
        {
          type: 'CardGrid',
          props: {
            id: 'services-cards',
            title: 'Como podemos ajudar',
            columns: '3',
            cards: [
              {
                title: 'Consultoria',
                text: 'Orientação personalizada para planejar seu próximo passo.',
                url: '/contato',
                image: null,
              },
              {
                title: 'Planejamento',
                text: 'Um plano claro para transformar suas ideias em resultados.',
                url: '/contato',
                image: null,
              },
              {
                title: 'Acompanhamento',
                text: 'Apoio próximo durante cada etapa do projeto.',
                url: '/contato',
                image: null,
              },
            ],
          },
        },
      ],
      root: {},
      zones: {},
    },
  },
} satisfies Record<string, { data: Data; description: string; label: string }>;

export type PageTemplateID = keyof typeof pageTemplates;
