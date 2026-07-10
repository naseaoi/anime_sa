export const requestWithSession = (path: string, options: RequestInit = {}) => {
  return fetch(path, {
    credentials: 'include',
    ...options
  });
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
