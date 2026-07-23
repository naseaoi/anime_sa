import { describe, expect, it } from 'vitest';
import { hashPassword, isValidPasswordHash, normalizeMediaName, verifyPasswordHash } from './sharedSecurity.js';

describe('normalizeMediaName', () => {
  it('accepts safe media names', () => {
    expect(normalizeMediaName('card.webp')).toBe('card.webp');
    expect(normalizeMediaName('card-1_original.png')).toBe('card-1_original.png');
  });

  it('rejects traversal and invalid names', () => {
    expect(normalizeMediaName('')).toBeNull();
    expect(normalizeMediaName('../private_data.json')).toBeNull();
    expect(normalizeMediaName('covers/card.webp')).toBeNull();
    expect(normalizeMediaName('card\\cover.webp')).toBeNull();
    expect(normalizeMediaName('a'.repeat(161))).toBeNull();
  });
});

describe('password hashes', () => {
  it('accepts generated hashes and rejects malformed parameters', async () => {
    const encoded = await hashPassword('secret');
    expect(isValidPasswordHash(encoded)).toBe(true);
    await expect(verifyPasswordHash('secret', encoded)).resolves.toBe(true);
    expect(isValidPasswordHash(encoded.replace('$16384$', '$1$'))).toBe(false);
    expect(isValidPasswordHash(`${encoded}$extra`)).toBe(false);
  });
});
