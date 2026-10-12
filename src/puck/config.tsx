import type { Config, CustomField } from '@puckeditor/core';
import type { Data } from '@puckeditor/core';
import { blockRegistry } from './blocks/registry';
import { MediaPickerField } from './MediaPickerField';
import type { MediaValue } from './blocks/types';

export const emptyPuckData: Data = {
  content: [],
  root: {},
  zones: {},
};

const mediaPicker: CustomField<MediaValue> = {
  label: 'Selecionar mídia',
  render: (props) => <MediaPickerField {...props} />,
  type: 'custom',
};

const readOnlyPageTitle: CustomField<string> = {
  contentEditable: false,
  label: 'Título da página',
  render: ({ value }) => (
    <div aria-readonly="true" className="puck-page-title-field">
      {value || 'Título da página'}
    </div>
  ),
  type: 'custom',
};

export const editorConfig: Config = {
  root: {
    fields: {
      title: readOnlyPageTitle,
    },
  },
  categories: {
    basics: {
      title: 'Básicos',
      components: ['Heading', 'Text', 'Image', 'Button', 'Spacer'],
    },
    sections: {
      title: 'Seções',
      components: ['Banner', 'CardGrid'],
    },
  },
  components: {
    Banner: {
      defaultProps: blockRegistry.Banner.defaultProps,
      fields: {
        title: { label: 'Título', type: 'text' },
        subtitle: { label: 'Subtítulo', type: 'textarea' },
        buttonLabel: { label: 'Texto do botão', type: 'text' },
        buttonUrl: { label: 'Link do botão', type: 'text' },
        backgroundImage: mediaPicker,
      },
      label: 'Banner',
      render: blockRegistry.Banner.render,
    },
    CardGrid: {
      defaultProps: blockRegistry.CardGrid.defaultProps,
      fields: {
        title: { label: 'Título da grade', type: 'text' },
        columns: {
          label: 'Colunas',
          options: [
            { label: 'Duas', value: '2' },
            { label: 'Três', value: '3' },
            { label: 'Quatro', value: '4' },
          ],
          type: 'select',
        },
        cards: {
          arrayFields: {
            title: { label: 'Título', type: 'text' },
            text: { label: 'Texto', type: 'textarea' },
            url: { label: 'Link', type: 'text' },
            image: mediaPicker,
          },
          defaultItemProps: {
            image: null,
            text: 'Descreva este destaque.',
            title: 'Novo destaque',
            url: '/',
          },
          getItemSummary: (card) => card.title || 'Card',
          label: 'Cards',
          max: 24,
          type: 'array',
        },
      },
      label: 'Grade de cards',
      render: blockRegistry.CardGrid.render,
    },
    Heading: {
      defaultProps: blockRegistry.Heading.defaultProps,
      fields: {
        text: { label: 'Título', type: 'text' },
        level: {
          label: 'Nível do título',
          options: [
            { label: 'Título 1', value: 'h1' },
            { label: 'Título 2', value: 'h2' },
            { label: 'Título 3', value: 'h3' },
          ],
          type: 'select',
        },
      },
      label: 'Título',
      render: blockRegistry.Heading.render,
    },
    Text: {
      defaultProps: blockRegistry.Text.defaultProps,
      fields: {
        text: { label: 'Texto', type: 'textarea' },
        align: {
          label: 'Alinhamento',
          options: [
            { label: 'Esquerda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Direita', value: 'right' },
          ],
          type: 'select',
        },
      },
      label: 'Texto',
      render: blockRegistry.Text.render,
    },
    Image: {
      defaultProps: blockRegistry.Image.defaultProps,
      fields: {
        image: mediaPicker,
        caption: { label: 'Legenda', type: 'text' },
      },
      label: 'Imagem',
      render: blockRegistry.Image.render,
    },
    Button: {
      defaultProps: blockRegistry.Button.defaultProps,
      fields: {
        label: { label: 'Texto do botão', type: 'text' },
        url: { label: 'Link', type: 'text' },
        style: {
          label: 'Estilo',
          options: [
            { label: 'Primário', value: 'primário' },
            { label: 'Secundário', value: 'secundário' },
          ],
          type: 'select',
        },
      },
      label: 'Botão',
      render: blockRegistry.Button.render,
    },
    Spacer: {
      defaultProps: blockRegistry.Spacer.defaultProps,
      fields: {
        size: {
          label: 'Espaçamento',
          options: [
            { label: 'Pequeno', value: 'pequeno' },
            { label: 'Médio', value: 'médio' },
            { label: 'Grande', value: 'grande' },
          ],
          type: 'select',
        },
      },
      label: 'Espaçador',
      render: blockRegistry.Spacer.render,
    },
  },
};
