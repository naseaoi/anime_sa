export const requestWithSession = (path: string, options: RequestInit = {}) => {
  return fetch(path, {
    credentials: 'include',
    ...options
  });
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status = 0, code = 'REQUEST_FAILED', details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errorMessage = (error: unknown, fallback = '请求失败') => {
  return error instanceof Error && error.message ? error.message : fallback;
};

export const readApiError = async (response: Response, fallback: string) => {
  const text = await response.text().catch(() => '');
  if (!text) return fallback;
  try {
    const payload = JSON.parse(text);
    return typeof payload?.error === 'string' ? payload.error : fallback;
  } catch {
    return text;
  }
};

export const readApiRequestError = async (response: Response, fallback: string) => {
  const text = await response.text().catch(() => '');
  if (!text) return new ApiRequestError(fallback, response.status);
  try {
    const payload = JSON.parse(text) as { error?: unknown; code?: unknown; details?: unknown };
    return new ApiRequestError(
      typeof payload.error === 'string' ? payload.error : fallback,
      response.status,
      typeof payload.code === 'string' ? payload.code : `HTTP_${response.status}`,
      payload.details
    );
  } catch {
    return new ApiRequestError(text, response.status, `HTTP_${response.status}`);
  }
};

export const requestJson = async <T>(path: string, options: RequestInit = {}, fallback = '请求失败'): Promise<T> => {
  let response: Response;
  try {
    response = await requestWithSession(path, options);
  } catch (error) {
    throw new ApiRequestError(errorMessage(error, fallback), 0, 'NETWORK_ERROR');
  }
  if (!response.ok) throw await readApiRequestError(response, fallback);
  try {
    return await response.json() as T;
  } catch {
    throw new ApiRequestError('服务端响应格式无效', response.status, 'INVALID_RESPONSE');
  }
};
