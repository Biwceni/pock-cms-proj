const placeholderSecret = /^(replace|troque|generate|changeme|change-me)/i;

export function isStrongPayloadSecret(secret: string | undefined): boolean {
  return Boolean(
    secret &&
      secret.length >= 32 &&
      new Set(secret).size >= 16 &&
      !placeholderSecret.test(secret),
  );
}
