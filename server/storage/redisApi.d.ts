export declare function handleRedisStorageApi(
  request: unknown,
  response: unknown,
  options: {
    env: Record<string, string | undefined>;
    isProduction?: boolean;
    runtime?: 'vercel' | 'node';
  }
): Promise<void>;
