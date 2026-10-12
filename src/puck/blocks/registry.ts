import { z } from 'zod';
import { sanitizeImageUrl, sanitizeLinkUrl } from '@/src/lib/puck-urls';
import { bannerDefaults, renderBanner } from './Banner';
import { buttonDefaults, renderButton } from './Button';
import { cardGridDefaults, renderCardGrid } from './CardGrid';
import { headingDefaults, renderHeading } from './Heading';
import { imageDefaults, renderImage } from './Image';
import { spacerDefaults, renderSpacer } from './Spacer';
import { textDefaults, renderText } from './Text';
import type { BlockDefinition, MediaValue } from './types';

const mediaValueSchema = z
  .object({
    alt: z.string().max(2000),
    height: z.number().int().positive().max(20000),
    id: z.union([z.number().int().positive(), z.string().min(1).max(200)]),
    url: z.string().max(2048).refine((url) => sanitizeImageUrl(url) !== null, {
      message: 'A URL da imagem não é permitida.',
    }),
    width: z.number().int().positive().max(20000),
  })
  .nullable();

const linkSchema = z.string().max(2048).refine((url) => sanitizeLinkUrl(url) !== null, {
  message: 'O endereço do link não é permitido.',
});

type RegisteredBlock = BlockDefinition & {
  defaultProps: Record<string, unknown>;
  propsSchema: z.ZodType;
  render: (props: never) => React.ReactElement;
};

export const blockRegistry = {
  Banner: {
    category: 'Seções',
    defaultProps: bannerDefaults,
    label: 'Banner',
    propsSchema: z.object({
      backgroundImage: mediaValueSchema.optional(),
      buttonLabel: z.string().max(200).optional(),
      buttonUrl: linkSchema.optional(),
      subtitle: z.string().max(20000).optional(),
      title: z.string().max(1000).optional(),
    }),
    render: renderBanner,
  },
  CardGrid: {
    category: 'Seções',
    defaultProps: cardGridDefaults,
    label: 'Grade de cards',
    propsSchema: z.object({
      cards: z.array(z.object({
        image: mediaValueSchema.optional(),
        text: z.string().max(10000),
        title: z.string().max(1000),
        url: linkSchema,
      })).max(24),
      columns: z.enum(['2', '3', '4']).optional(),
      title: z.string().max(1000).optional(),
    }),
    render: renderCardGrid,
  },
  Heading: {
    category: 'Básicos',
    defaultProps: headingDefaults,
    label: 'Título',
    propsSchema: z.object({
      level: z.enum(['h1', 'h2', 'h3']).optional(),
      text: z.string().max(20000).optional(),
    }),
    render: renderHeading,
  },
  Text: {
    category: 'Básicos',
    defaultProps: textDefaults,
    label: 'Texto',
    propsSchema: z.object({
      align: z.enum(['left', 'center', 'right']).optional(),
      text: z.string().max(20000).optional(),
    }),
    render: renderText,
  },
  Image: {
    category: 'Básicos',
    defaultProps: imageDefaults,
    label: 'Imagem',
    propsSchema: z.object({
      caption: z.string().max(2000).optional(),
      image: mediaValueSchema,
    }),
    render: renderImage,
  },
  Button: {
    category: 'Básicos',
    defaultProps: buttonDefaults,
    label: 'Botão',
    propsSchema: z.object({
      label: z.string().max(200).optional(),
      style: z.enum(['primário', 'secundário']).optional(),
      url: linkSchema,
    }),
    render: renderButton,
  },
  Spacer: {
    category: 'Básicos',
    defaultProps: spacerDefaults,
    label: 'Espaçador',
    propsSchema: z.object({
      size: z.enum(['pequeno', 'médio', 'grande']).optional(),
    }),
    render: renderSpacer,
  },
} satisfies Record<string, RegisteredBlock>;

export type PuckBlockType = keyof typeof blockRegistry;
export const puckBlockTypes = Object.keys(blockRegistry) as PuckBlockType[];
export type { MediaValue };
