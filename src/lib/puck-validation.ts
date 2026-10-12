import { ValidationError } from 'payload';
import { z } from 'zod';
import { blockRegistry, puckBlockTypes } from '@/src/puck/blocks/registry';

export const MAX_PUCK_DATA_BYTES = 250_000;
export const MAX_PUCK_BLOCKS = 100;
export const MAX_PUCK_DEPTH = 8;

const puckDataSchema = z
  .object({
    content: z.array(z.unknown()).max(MAX_PUCK_BLOCKS, {
      message: 'O editor visual excedeu o limite de 100 blocos nesta página.',
    }),
    root: z.record(z.string(), z.unknown()).optional(),
    zones: z.record(z.string(), z.array(z.unknown())).optional(),
  })
  .passthrough();

function computeNestingDepth(value: unknown, currentDepth = 0): number {
  if (value === null || value === undefined || typeof value !== 'object') {
    return currentDepth;
  }

  const values = Array.isArray(value) ? value : Object.values(value);
  return values.reduce<number>(
    (maxDepth, item) => Math.max(maxDepth, computeNestingDepth(item, currentDepth + 1)),
    currentDepth,
  );
}

function validateBlock(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'Cada bloco do editor visual deve ser um objeto válido.';
  }

  const block = value as Record<string, unknown>;
  if (typeof block.type !== 'string' || !Object.hasOwn(blockRegistry, block.type)) {
    return `Tipo de bloco desconhecido. Os blocos aceitos são: ${puckBlockTypes.join(', ')}.`;
  }

  if (typeof block.props !== 'object' || block.props === null || Array.isArray(block.props)) {
    return `As propriedades do bloco ${block.type} devem ser um objeto válido.`;
  }

  const result = blockRegistry[block.type as keyof typeof blockRegistry].propsSchema.safeParse(block.props);
  return result.success ? null : result.error.issues[0]?.message ?? 'As propriedades do bloco são inválidas.';
}

function validateBlocks(blocks: unknown[]): string | null {
  for (const block of blocks) {
    const blockError = validateBlock(block);
    if (blockError) {
      return blockError;
    }
  }
  return null;
}

export function validatePuckDataForPages(value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(
      { errors: [{ message: 'O campo puckData deve ser um objeto em JSON.', path: 'puckData' }] },
      undefined,
    );
  }

  const serializedSize = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (serializedSize > MAX_PUCK_DATA_BYTES) {
    throw new ValidationError(
      { errors: [{ message: 'O conteúdo do editor visual excedeu o limite de 250 KB.', path: 'puckData' }] },
      undefined,
    );
  }

  if (computeNestingDepth(value) > MAX_PUCK_DEPTH) {
    throw new ValidationError(
      { errors: [{ message: 'A estrutura do editor visual está muito profunda.', path: 'puckData' }] },
      undefined,
    );
  }

  const parsed = puckDataSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(
      { errors: [{ message: 'A estrutura do editor visual é inválida.', path: 'puckData' }] },
      undefined,
    );
  }

  const data = parsed.data;
  const blockError = validateBlocks(data.content);
  if (blockError) {
    throw new ValidationError({ errors: [{ message: blockError, path: 'puckData' }] }, undefined);
  }

  for (const zoneBlocks of Object.values(data.zones ?? {})) {
    const zoneError = validateBlocks(zoneBlocks);
    if (zoneError) {
      throw new ValidationError({ errors: [{ message: zoneError, path: 'puckData' }] }, undefined);
    }
  }
}
