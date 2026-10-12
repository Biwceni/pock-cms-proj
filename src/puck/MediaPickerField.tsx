'use client';

import type { CustomFieldRender } from '@puckeditor/core';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { toRelativeImageUrl } from '@/src/lib/puck-urls';
import type { MediaValue } from './blocks/types';

type MediaDoc = {
  alt?: unknown;
  height?: unknown;
  id?: unknown;
  url?: unknown;
  width?: unknown;
};

function normalizeMedia(value: unknown, origin: string): MediaValue {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const media = value as MediaDoc;
  const url = toRelativeImageUrl(media.url, origin);
  if (
    (typeof media.id !== 'number' && typeof media.id !== 'string') ||
    !url
  ) {
    return null;
  }

  return {
    alt: typeof media.alt === 'string' ? media.alt : '',
    height: typeof media.height === 'number' && media.height > 0 ? media.height : 600,
    id: media.id,
    url,
    width: typeof media.width === 'number' && media.width > 0 ? media.width : 900,
  };
}

type PickerProps = Parameters<CustomFieldRender<MediaValue>>[0];

export function MediaPickerField({ onChange, value }: PickerProps) {
  const [items, setItems] = useState<Array<NonNullable<MediaValue>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/media?limit=100&sort=-createdAt&depth=0', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Não foi possível carregar a biblioteca de mídia (HTTP ${response.status}).`);
        }
        const result = (await response.json()) as { docs?: unknown[] };
        const mediaItems = (result.docs ?? [])
          .map((item) => normalizeMedia(item, window.location.origin))
          .filter((item): item is NonNullable<MediaValue> => item !== null);
        if (active) {
          setItems(mediaItems);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar a biblioteca de mídia.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function uploadFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('alt', file.name.replace(/\.[^.]+$/, ''));
    formData.append('file', file);

    try {
      const response = await fetch('/api/media', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`O upload da imagem falhou (HTTP ${response.status}).`);
      }

      const document = normalizeMedia(await response.json(), window.location.origin);
      if (!document) {
        throw new Error('O Payload não retornou uma imagem válida após o upload.');
      }

      setItems((current) => [document, ...current.filter((item) => item.id !== document.id)]);
      onChange(document);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Falha inesperada no upload.');
    } finally {
      setUploading(false);
    }
  }

  const selectedId = value?.id === undefined ? '' : String(value.id);

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <label>
        Biblioteca de mídia
        <select
          aria-label="Selecionar imagem da biblioteca"
          disabled={loading}
          onChange={(event) => {
            const selected = items.find((item) => String(item.id) === event.target.value);
            onChange(selected ?? null);
          }}
          value={selectedId}
        >
          <option value="">Sem imagem</option>
          {items.map((item) => (
            <option key={String(item.id)} value={String(item.id)}>
              {item.alt || `Imagem ${item.id}`}
            </option>
          ))}
        </select>
      </label>
      <label>
        Enviar nova imagem
        <input
          accept="image/*"
          disabled={uploading}
          onChange={(event) => {
            void uploadFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
          type="file"
        />
      </label>
      {loading ? <span>Carregando mídias…</span> : null}
      {uploading ? <span>Enviando imagem…</span> : null}
      {value ? <Image alt={value.alt} height={72} src={value.url} style={{ height: 72, objectFit: 'cover', width: 120 }} unoptimized width={120} /> : null}
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
