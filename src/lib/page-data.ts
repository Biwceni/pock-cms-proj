export const emptyPuckData = {
  root: {},
  content: [],
  zones: {},
};

export const samplePageData = {
  root: {},
  content: [
    {
      type: 'banner',
      props: {
        title: 'Sua presença digital, sem complicação.',
        subtitle: 'Um CMS headless com editor visual para páginas modernas e rápidas.',
        buttonLabel: 'Falar com a equipe',
        href: '#contato',
        imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
      },
    },
    {
      type: 'cardGrid',
      props: {
        title: 'O que você ganha',
        cards: [
          {
            title: 'Editor visual',
            body: 'Monta páginas com blocos prontos e sem precisar entender código.',
            imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=700&q=80',
          },
          {
            title: 'CMS headless',
            body: 'Seu conteúdo fica disponível para qualquer frontend via API do Payload.',
            imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=700&q=80',
          },
          {
            title: 'SEO simples',
            body: 'Você publica, revalida e a página sai do ar e volta em poucos segundos.',
            imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=700&q=80',
          },
        ],
      },
    },
    {
      type: 'heading',
      props: {
        text: 'Conteúdo pensado para conversão',
        level: 'h2',
        align: 'left',
      },
    },
    {
      type: 'text',
      props: {
        content: 'Crie campanhas, páginas institucionais e materiais promocionais em minutos, mantendo o texto e as imagens em um único lugar.',
        align: 'left',
      },
    },
  ],
  zones: {},
};
