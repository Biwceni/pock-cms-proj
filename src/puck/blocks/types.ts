import type { PuckContext } from '@puckeditor/core';

export type MediaValue = {
  alt: string;
  height: number;
  id: number | string;
  url: string;
  width: number;
} | null;

export type BlockDefinition = {
  category: 'Básicos' | 'Seções';
  defaultProps: Record<string, unknown>;
  label: string;
};

export type PuckRenderContext = {
  editMode?: boolean;
  id?: string;
  puck?: PuckContext;
};
