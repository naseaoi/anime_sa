import { describe, expect, it } from 'vitest';
import { detectImageContentType, normalizeImageContentType, validateImageBytes } from './mediaValidation.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe('media validation', () => {
  it('detects supported image signatures', () => {
    expect(detectImageContentType(png)).toBe('image/png');
    expect(detectImageContentType(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(detectImageContentType(Buffer.from('GIF89a', 'ascii'))).toBe('image/gif');
  });

  it('rejects active content and mismatched declarations', () => {
    expect(normalizeImageContentType('image/svg+xml')).toBeNull();
    expect(validateImageBytes('image/jpeg', png)).toBeNull();
    expect(validateImageBytes('image/png; charset=binary', png)?.contentType).toBe('image/png');
  });
});
