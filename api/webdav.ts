
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Buffer } from 'buffer';

export const config = {
  api: {
    bodyParser: false
  }
};

const MEDIA_BODY_LIMIT_BYTES = 15 * 1024 * 1024;

const readRawBody = (request: VercelRequest, limit: number): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        request.destroy();
        reject(new Error('Payload too large'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', (error) => reject(error));
  });
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const { WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, WEBDAV_PATH } = process.env;

  if (!WEBDAV_URL || !WEBDAV_USERNAME || !WEBDAV_PASSWORD) {
    return response.status(500).json({ error: 'Missing WebDAV configuration' });
  }

  const { filename } = request.query;
  const safeFilename = Array.isArray(filename) ? filename[0] : (filename || '');
  
  // 智能缓存策略
  // Smart Caching Strategy
  const ext = safeFilename.split('.').pop()?.toLowerCase();
  const isMedia = ext && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'avif', 'mp4', 'webm', 'mov'].includes(ext);

  if (isMedia) {
    // Media files: Cache for 30 days (2592000 seconds)
    // public: Allows CDNs (like Vercel Edge) to cache
    // immutable: Indicates the content won't change
    response.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, immutable');
    // Remove headers that might prevent caching
    response.removeHeader('Pragma');
    response.removeHeader('Expires');
  } else {
    // JSON/Data files: No cache strictly
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
  }

  // Support Method Tunneling via header
  const tunneledMethod = request.headers['x-dav-method'];
  const method = (Array.isArray(tunneledMethod) ? tunneledMethod[0] : tunneledMethod) || request.method;

  const cleanBaseUrl = WEBDAV_URL.replace(/\/+$/, '');
  const cleanPath = (WEBDAV_PATH || 'my-collection').replace(/^\/+|\/+$/g, '');
  
  let targetUrl = `${cleanBaseUrl}/${cleanPath}`;
  if (safeFilename) {
    targetUrl += `/${safeFilename}`;
  } else {
    targetUrl += '/';
  }

  // Use btoa instead of Buffer to avoid TypeScript "Cannot find name 'Buffer'" error in serverless environment
  const authHeader = 'Basic ' + btoa(`${WEBDAV_USERNAME}:${WEBDAV_PASSWORD}`);
  
  // Use a high-trust desktop User-Agent for all outgoing requests
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'User-Agent': userAgent,
  };

  if (request.headers['depth']) headers['Depth'] = request.headers['depth'] as string;
  if (request.headers['content-type']) headers['Content-Type'] = request.headers['content-type'] as string;

  const fetchOptions: RequestInit = {
    method: method,
    headers: headers,
  };

  // Only pass body for specific methods
  let rawBody: Buffer | null = null;
  if (['PUT', 'PROPPATCH', 'POST', 'DELETE', 'MKCOL', 'MOVE', 'COPY'].includes(method)) {
    try {
      rawBody = await readRawBody(request, MEDIA_BODY_LIMIT_BYTES);
    } catch (error: any) {
      if (error?.message === 'Payload too large') {
        return response.status(413).json({ error: 'Payload too large' });
      }
      return response.status(500).json({ error: 'Proxy Error', message: error?.message });
    }
    if (rawBody.length > 0) {
      fetchOptions.body = rawBody as unknown as BodyInit;
    }
  }

  try {
    const davResponse = await fetch(targetUrl, fetchOptions);
    response.status(davResponse.status);
    
    // Pass specific content-type from WebDAV if available, helpful for browsers to render images correctly
    const contentType = davResponse.headers.get('content-type');
    if (contentType) {
      response.setHeader('Content-Type', contentType);
    }

    if (davResponse.status === 204) return response.end();

    const buffer = await davResponse.arrayBuffer();
    return response.send(Buffer.from(buffer));

  } catch (error: any) {
    // If it's a media request error, we still want to return a proper error, 
    // but typically fetch errors for static assets show as broken images.
    return response.status(500).json({ error: 'Proxy Error', message: error.message });
  }
}
