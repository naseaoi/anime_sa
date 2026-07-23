import { describe, expect, it, vi } from 'vitest';
import { fetchRemoteImage, RemoteImageError } from './remoteImage.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe('remote image fetch', () => {
  it('validates every redirect before following it', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/private.png' }
    }));

    await expect(fetchRemoteImage('https://example.com/image.png', { fetchImpl })).rejects.toMatchObject({
      status: 403
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('accepts a supported image with matching bytes', async () => {
    const fetchImpl = vi.fn(async () => new Response(png, {
      status: 200,
      headers: { 'content-type': 'image/png' }
    }));

    const result = await fetchRemoteImage('https://example.com/image.png', { fetchImpl });
    expect(result.contentType).toBe('image/png');
    expect(result.bytes).toEqual(png);
  });

  it('stops reading when the stream exceeds its limit', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array(10 * 1024 * 1024 + 1), {
      status: 200,
      headers: { 'content-type': 'image/png' }
    }));

    await expect(fetchRemoteImage('https://example.com/image.png', { fetchImpl })).rejects.toBeInstanceOf(RemoteImageError);
    await expect(fetchRemoteImage('https://example.com/image.png', { fetchImpl })).rejects.toMatchObject({ status: 413 });
  });
});
