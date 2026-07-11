export declare function handleStorageTransferApi(
  request: unknown,
  response: unknown,
  options: {
    env: Record<string, string | undefined>;
    driver: 'sqlite' | 'redis';
  }
): Promise<void>;
