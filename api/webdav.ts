import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const { VITE_WEBDAV_URL, VITE_WEBDAV_USERNAME, VITE_WEBDAV_PASSWORD, VITE_WEBDAV_PATH } = process.env;

  if (!VITE_WEBDAV_URL || !VITE_WEBDAV_USERNAME || !VITE_WEBDAV_PASSWORD) {
    return response.status(500).json({ error: 'Missing WebDAV configuration in environment variables' });
  }

  const { filename } = request.query;
  const method = request.method;

  // URL Construction
  // Remove trailing slashes from base URL to ensure clean join
  const cleanBaseUrl = VITE_WEBDAV_URL.replace(/\/+$/, '');
  const cleanPath = (VITE_WEBDAV_PATH || 'my-collection').replace(/^\/+|\/+$/g, '');
  
  // Handle filename
  const safeFilename = Array.isArray(filename) ? filename[0] : (filename || '');
  
  // Construct URL: Base + Path + Filename
  // If safeFilename is empty, we are targeting the directory (cleanPath) itself.
  // We add a trailing slash for directory operations (PROPFIND/MKCOL on the folder) 
  // to be safe with strict WebDAV servers.
  let targetUrl = `${cleanBaseUrl}/${cleanPath}`;
  if (safeFilename) {
    targetUrl += `/${safeFilename}`;
  } else {
    targetUrl += '/';
  }

  const authHeader = 'Basic ' + Buffer.from(`${VITE_WEBDAV_USERNAME}:${VITE_WEBDAV_PASSWORD}`).toString('base64');

  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'User-Agent': 'NicheCard/1.0', // Important: Some servers block empty UA
  };

  // Forward WebDAV headers
  if (request.headers['depth']) headers['Depth'] = request.headers['depth'] as string;
  if (request.headers['content-type']) headers['Content-Type'] = request.headers['content-type'] as string;

  const fetchOptions: RequestInit = {
    method: method,
    headers: headers,
  };

  if (method === 'PUT') {
    // Handling Body for PUT
    // If Vercel parsed JSON, stringify it back.
    // If it's a string/buffer, use it directly.
    if (request.body && typeof request.body === 'object') {
       fetchOptions.body = JSON.stringify(request.body);
    } else {
       fetchOptions.body = request.body;
    }
  }

  try {
    const davResponse = await fetch(targetUrl, fetchOptions);

    // Pass the status code back
    response.status(davResponse.status);

    // Handle 204 No Content (common for PUT success)
    if (davResponse.status === 204) {
        return response.end();
    }

    const text = await davResponse.text();

    // If upstream error, pass the text for debugging
    if (!davResponse.ok) {
        console.error(`WebDAV Error [${method} ${targetUrl}]: ${davResponse.status} - ${text}`);
        return response.send(text);
    }

    // Try to return JSON if it looks like JSON
    try {
        const json = JSON.parse(text);
        return response.json(json);
    } catch {
        // Otherwise return text (XML for PROPFIND, etc)
        return response.send(text);
    }

  } catch (error: any) {
    console.error('Proxy Internal Error:', error);
    return response.status(500).json({ 
      error: 'Proxy Internal Error', 
      details: error.message,
      target: targetUrl // debug info
    });
  }
}