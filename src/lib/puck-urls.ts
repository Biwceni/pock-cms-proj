const controlCharacters = /[\u0000-\u001f\u007f]/;
const explicitScheme = /^[a-z][a-z\d+.-]*:/i;

export function sanitizeLinkUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const url = value.trim();
  if (!url || controlCharacters.test(url) || url.includes('\\') || url.startsWith('//')) {
    return null;
  }

  if (!explicitScheme.test(url)) {
    return url;
  }

  const protocol = url.slice(0, url.indexOf(':')).toLowerCase();
  if (protocol === 'http' || protocol === 'https') {
    try {
      const parsed = new URL(url);
      return parsed.hostname && !parsed.username && !parsed.password ? url : null;
    } catch {
      return null;
    }
  }

  if (protocol === 'mailto') {
    return url.slice('mailto:'.length).includes('@') ? url : null;
  }

  if (protocol === 'tel') {
    return url.slice('tel:'.length).trim() ? url : null;
  }

  return null;
}

export function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const url = value.trim();
  if (!url || controlCharacters.test(url) || url.includes('\\') || url.startsWith('//')) {
    return null;
  }

  if (url.startsWith('/')) {
    return url;
  }

  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname && !parsed.username && !parsed.password ? url : null;
  } catch {
    return null;
  }
}

export function toRelativeImageUrl(value: unknown, origin: string): string | null {
  const url = sanitizeImageUrl(value);
  if (!url) {
    return null;
  }

  if (url.startsWith('/')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.origin !== new URL(origin).origin) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}
