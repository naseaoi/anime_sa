import { describe, expect, it } from 'vitest';
import { normalizeMediaName } from './sharedSecurity.js';

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
