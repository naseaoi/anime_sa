import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const { VITE_WEBDAV_URL, VITE_WEBDAV_USERNAME, VITE_WEBDAV_PASSWORD, VITE_WEBDAV_PATH } = process.env;

  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');

  if (!VITE_WEBDAV_URL || !VITE_WEBDAV_USERNAME || !VITE_WEBDAV_PASSWORD) {
    return response.status(500).json({ error: 'Missing WebDAV configuration' });
  }

  const { filename } = request.query;
  
  // Support Method Tunneling via header
  const tunneledMethod = request.headers['x-dav-method'];
  const method = (Array.isArray(tunneledMethod) ? tunneledMethod[0] : tunneledMethod) || request.method;

  const cleanBaseUrl = VITE_WEBDAV_URL.replace(/\/+$/, '');
  const cleanPath = (VITE_WEBDAV_PATH || 'my-collection').replace(/^\/+|\/+$/g, '');
  const safeFilename = Array.isArray(filename) ? filename[0] : (filename || '');
  
  let targetUrl = `${cleanBaseUrl}/${cleanPath}`;
  if (safeFilename) {
    targetUrl += `/${safeFilename}`;
  } else {
    targetUrl += '/';
  }

  const authHeader = 'Basic ' + Buffer.from(`${VITE_WEBDAV_USERNAME}:${VITE_WEBDAV_PASSWORD}`).toString('base64');
  
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
  if (['PUT', 'PROPPATCH', 'POST'].includes(method)) {
    // Vercel handles body parsing, so we might need to stringify it back if it's already an object
    if (request.body && typeof request.body === 'object' && Object.keys(request.body).length > 0) {
       fetchOptions.body = JSON.stringify(request.body);
    } else if (request.body) {
       fetchOptions.body = request.body;
    }
  }

  try {
    const davResponse = await fetch(targetUrl, fetchOptions);
    response.status(davResponse.status);
    
    if (davResponse.status === 204) return response.end();

    const text = await davResponse.text();
    if (!davResponse.ok) return response.send(text);

    try {
        const json = JSON.parse(text);
        return response.json(json);
    } catch {
        return response.send(text);
    }
  } catch (error: any) {
    return response.status(500).json({ error: 'Proxy Error', message: error.message });
  }
}