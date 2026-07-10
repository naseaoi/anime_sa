export function handleSqliteApi(
  request: unknown,
  response: unknown,
  options: { env: Record<string, string>; isProduction?: boolean }
): Promise<void>;

export function handleWebDavApi(
  request: unknown,
  response: unknown,
  options: { env: Record<string, string> }
): Promise<void>;
