import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('auth session checks', () => {
  it('deduplicates concurrent checks and reuses the short cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ authenticated: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { checkSession } = await import('./authClient');

    expect(await Promise.all([checkSession(), checkSession()])).toEqual([true, true]);
    expect(await checkSession()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache when forced', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { checkSession } = await import('./authClient');

    expect(await checkSession()).toBe(true);
    expect(await checkSession(true)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('discards an in-flight result after authentication changes', async () => {
    let resolveStale: ((response: Response) => void) | undefined;
    const staleResponse = new Promise<Response>((resolve) => { resolveStale = resolve; });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => staleResponse)
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { checkSession, notifyAuthChanged } = await import('./authClient');

    const staleCheck = checkSession();
    notifyAuthChanged();
    const currentCheck = checkSession();
    resolveStale?.(new Response(JSON.stringify({ authenticated: false }), { status: 200 }));

    expect(await Promise.all([staleCheck, currentCheck])).toEqual([true, true]);
    expect(await checkSession()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
