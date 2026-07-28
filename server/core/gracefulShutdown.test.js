import { describe, expect, it, vi } from 'vitest';
import { createGracefulShutdown } from './gracefulShutdown.js';

describe('graceful shutdown', () => {
  it('closes the server and storage once', async () => {
    const closeStorage = vi.fn(async () => {});
    const server = { close: vi.fn((callback) => callback()) };
    const shutdown = createGracefulShutdown({ server, closeStorage });

    const first = shutdown('SIGTERM');
    const second = shutdown('SIGINT');
    const result = await first;

    expect(second).toBe(first);
    expect(result).toEqual({ signal: 'SIGTERM', error: null });
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(closeStorage).toHaveBeenCalledTimes(1);
  });
});
