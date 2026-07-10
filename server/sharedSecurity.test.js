import { describe, expect, it } from 'vitest';
import { normalizeWebDavFilename } from './sharedSecurity.js';

describe('normalizeWebDavFilename', () => {
  it('accepts public files and cover paths', () => {
    expect(normalizeWebDavFilename('')).toBe('');
    expect(normalizeWebDavFilename('public_data.json')).toBe('public_data.json');
    expect(normalizeWebDavFilename('private_data.json')).toBe('private_data.json');
    expect(normalizeWebDavFilename('covers')).toBe('covers');
    expect(normalizeWebDavFilename('covers/card.webp')).toBe('covers/card.webp');
  });

  it('rejects traversal and unknown paths', () => {
    expect(normalizeWebDavFilename('../private_data.json')).toBeNull();
    expect(normalizeWebDavFilename('folder/../private_data.json')).toBeNull();
    expect(normalizeWebDavFilename('covers\\card.webp')).toBeNull();
    expect(normalizeWebDavFilename('covers//card.webp')).toBeNull();
    expect(normalizeWebDavFilename('unknown.json')).toBeNull();
    expect(normalizeWebDavFilename('covers/nested/card.webp')).toBeNull();
  });
});
