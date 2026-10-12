import type { Data } from '@puckeditor/core';

export const phaseTwoPageData: Data = {
  root: {},
  content: [
    {
      type: 'Heading',
      props: {
        id: 'phase-two-heading',
        text: 'Site público da Fase 2',
      },
    },
    {
      type: 'Text',
      props: {
        id: 'phase-two-text',
        text: 'Página de validação publicada com Puck e Payload.',
      },
    },
  ],
};

export const phaseTwoDraftData: Data = {
  root: {},
  content: [
    {
      type: 'Heading',
      props: {
        id: 'phase-two-draft-heading',
        text: 'Este rascunho não deve aparecer',
      },
    },
  ],
};
