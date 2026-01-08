import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const { VITE_WEBDAV_URL, VITE_WEBDAV_USERNAME, VITE_WEBDAV_PASSWORD, VITE_WEBDAV_PATH } = process.env;

  if (!VITE_WEBDAV_URL || !VITE_WEBDAV_USERNAME || !VITE_WEBDAV_PASSWORD) {
    return response.status(500).json({ error: 'Missing WebDAV configuration in environment variables' });
  }

  const { filename } = request.query;
  const method = request.method;

  // URL Construction
  const cleanBaseUrl = VITE_WEBDAV_URL.replace(/\/+$/, '');
  const cleanPath = (VITE_WEBDAV_PATH || 'my-collection').replace(/^\/+|\/+$/g, '');
  
  // Handle filename
  // If filename is empty, we target the directory itself.
  const safeFilename = Array.isArray(filename) ? filename[0] : (filename || '');
  
  // Construct URL
  let targetUrl = `${cleanBaseUrl}/${cleanPath}`;
  if (safeFilename) {
    targetUrl += `/${safeFilename}`;
  } else {
    // For directory operations (PROPFIND/MKCOL on the folder), trailing slash is usually good practice
    targetUrl += '/';
  }

  const authHeader = 'Basic ' + Buffer.from(`${VITE_WEBDAV_USERNAME}:${VITE_WEBDAV_PASSWORD}`).toString('base64');

  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'User-Agent': 'WebDAVClient/1.0', // Use a generic-looking UA
  };

  // Forward specific headers
  if (request.headers['depth']) headers['Depth'] = request.headers['depth'] as string;
  if (request.headers['content-type']) headers['Content-Type'] = request.headers['content-type'] as string;

  const fetchOptions: RequestInit = {
    method: method,
    headers: headers,
  };

  // Body Handling
  // MKCOL/GET/HEAD/PROPFIND(usually) should not have body or strict handling
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
    
    // Handle 204 No Content
    if (davResponse.status === 204) {
        return response.end();
    }

    const text = await davResponse.text();

    if (!davResponse.ok) {
        console.error(`[WebDAV Proxy Error] ${method} ${targetUrl} -> ${davResponse.status}`);
        console.error(`[Upstream Response] ${text}`);
        // Return text so frontend can log it
        return response.send(text);
    }

    // Try parsing JSON
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
      target: targetUrl 
    });
  }
}