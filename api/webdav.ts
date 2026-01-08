import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const { VITE_WEBDAV_URL, VITE_WEBDAV_USERNAME, VITE_WEBDAV_PASSWORD, VITE_WEBDAV_PATH } = process.env;

  // Add no-store headers to Vercel response to prevent caching at edge
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');

  if (!VITE_WEBDAV_URL || !VITE_WEBDAV_USERNAME || !VITE_WEBDAV_PASSWORD) {
    return response.status(500).json({ error: 'Missing WebDAV configuration in environment variables' });
  }

  const { filename } = request.query;
  const method = request.method;

  // URL Construction
  const cleanBaseUrl = VITE_WEBDAV_URL.replace(/\/+$/, '');
  const cleanPath = (VITE_WEBDAV_PATH || 'my-collection').replace(/^\/+|\/+$/g, '');
  
  // Handle filename
  const safeFilename = Array.isArray(filename) ? filename[0] : (filename || '');
  
  // Construct URL
  let targetUrl = `${cleanBaseUrl}/${cleanPath}`;
  if (safeFilename) {
    targetUrl += `/${safeFilename}`;
  } else {
    // For directory operations, trailing slash is important
    targetUrl += '/';
  }

  const authHeader = 'Basic ' + Buffer.from(`${VITE_WEBDAV_USERNAME}:${VITE_WEBDAV_PASSWORD}`).toString('base64');

  // Vercel WAF can block non-standard User-Agents, especially on mobile networks.
  // Forwarding the original User-Agent from the client makes the request look legitimate.
  const userAgent = request.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'User-Agent': userAgent,
  };

  if (request.headers['depth']) headers['Depth'] = request.headers['depth'] as string;
  if (request.headers['content-type']) headers['Content-Type'] = request.headers['content-type'] as string;

  const fetchOptions: RequestInit = {
    method: method,
    headers: headers,
    cache: 'no-store' // Node-fetch might not use this but good for clarity
  };

  if (method === 'PUT' || method === 'PROPPATCH') {
    if (request.body && typeof request.body === 'object') {
       fetchOptions.body = JSON.stringify(request.body);
    } else {
       fetchOptions.body = request.body;
    }
  }

  try {
    const davResponse = await fetch(targetUrl, fetchOptions);

    response.status(davResponse.status);
    
    if (davResponse.status === 204) {
        return response.end();
    }

    const text = await davResponse.text();

    if (!davResponse.ok) {
        console.error(`[WebDAV Proxy Error] ${method} ${targetUrl} -> ${davResponse.status}`);
        return response.send(text);
    }

    try {
        const json = JSON.parse(text);
        return response.json(json);
    } catch {
        return response.send(text);
    }

  } catch (error: any) {
    console.error('[Proxy Internal Error]', error);
    return response.status(500).json({ 
      error: 'Proxy Internal Error', 
      message: error.message,
    });
  }
}