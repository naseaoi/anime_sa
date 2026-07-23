import { MEDIA_BODY_LIMIT_BYTES } from './constants.js';
import { normalizeImageContentType, validateImageBytes } from './mediaValidation.js';
import { isBlockedRemoteHost, safeFetchAgent } from './remoteSecurity.js';

const REMOTE_USER_AGENT = 'anime-sa/1.0';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const REMOTE_TIMEOUT_MS = 15_000;

export class RemoteImageError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const parseAllowedUrl = (value) => {
  let target;
  try {
    target = new URL(value);
  } catch {
    throw new RemoteImageError(400, 'Invalid remote image url');
  }
  if (!['http:', 'https:'].includes(target.protocol)) throw new RemoteImageError(400, 'Only http/https urls are allowed');
  if (isBlockedRemoteHost(target.hostname)) throw new RemoteImageError(403, 'Remote host is not allowed');
  return target;
};

export const readLimitedResponseBody = async (response, limit, controller) => {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    received += chunk.length;
    if (received > limit) {
      await reader.cancel().catch(() => {});
      controller.abort();
      throw new RemoteImageError(413, 'Remote image too large');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, received);
};

export const fetchRemoteImage = async (
  rawTarget,
  { fetchImpl = fetch, timeoutMs = REMOTE_TIMEOUT_MS, maxRedirects = MAX_REDIRECTS } = {}
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let target = parseAllowedUrl(rawTarget);

  try {
    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      const upstream = await fetchImpl(target.toString(), /** @type {RequestInit & { dispatcher: unknown }} */ ({
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': REMOTE_USER_AGENT, Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
        dispatcher: safeFetchAgent
      }));

      if (REDIRECT_STATUSES.has(upstream.status)) {
        const location = upstream.headers.get('location');
        await upstream.body?.cancel().catch(() => {});
        if (!location) throw new RemoteImageError(502, 'Remote redirect is missing a location');
        if (redirects === maxRedirects) throw new RemoteImageError(502, 'Too many remote redirects');
        target = parseAllowedUrl(new URL(location, target).toString());
        continue;
      }

      if (!upstream.ok) throw new RemoteImageError(502, `Remote fetch failed (${upstream.status})`);
      const contentType = normalizeImageContentType(upstream.headers.get('content-type'));
      if (!contentType) throw new RemoteImageError(415, 'Remote resource is not a supported image');
      const contentLength = Number(upstream.headers.get('content-length') || '0');
      if (Number.isFinite(contentLength) && contentLength > MEDIA_BODY_LIMIT_BYTES) {
        throw new RemoteImageError(413, 'Remote image too large');
      }

      const bytes = await readLimitedResponseBody(upstream, MEDIA_BODY_LIMIT_BYTES, controller);
      const validated = validateImageBytes(contentType, bytes);
      if (!validated) throw new RemoteImageError(415, 'Remote image content does not match its type');
      return validated;
    }
    throw new RemoteImageError(502, 'Too many remote redirects');
  } catch (error) {
    if (error instanceof RemoteImageError) throw error;
    if (controller.signal.aborted) throw new RemoteImageError(502, 'Remote image request timed out');
    throw new RemoteImageError(502, 'Remote image request failed');
  } finally {
    clearTimeout(timeout);
  }
};
