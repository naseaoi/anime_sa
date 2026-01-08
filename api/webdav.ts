import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const { VITE_WEBDAV_URL, VITE_WEBDAV_USERNAME, VITE_WEBDAV_PASSWORD, VITE_WEBDAV_PATH } = process.env;

  if (!VITE_WEBDAV_URL || !VITE_WEBDAV_USERNAME || !VITE_WEBDAV_PASSWORD) {
    return response.status(500).json({ error: 'Missing WebDAV configuration in environment variables' });
  }

  const { filename } = request.query;
  const method = request.method;

  // Construct target URL
  const baseUrl = VITE_WEBDAV_URL.endsWith('/') ? VITE_WEBDAV_URL : `${VITE_WEBDAV_URL}/`;
  const basePath = (VITE_WEBDAV_PATH || 'my-collection/').replace(/^\/|\/$/g, '');
  
  // Handle filename: if empty, we target the directory itself
  const safeFilename = Array.isArray(filename) ? filename[0] : (filename || '');
  
  const targetUrl = safeFilename 
    ? `${baseUrl}${basePath}/${safeFilename}`
    : `${baseUrl}${basePath}/`;

  const authHeader = 'Basic ' + Buffer.from(`${VITE_WEBDAV_USERNAME}:${VITE_WEBDAV_PASSWORD}`).toString('base64');

  const headers: Record<string, string> = {
    'Authorization': authHeader,
  };

  // Forward specific headers
  if (request.headers['depth']) {
    headers['Depth'] = request.headers['depth'] as string;
  }
  
  if (method === 'PUT') {
      headers['Content-Type'] = 'application/json';
  }

  try {
    const fetchOptions: RequestInit = {
      method: method,
      headers: headers,
    };

    if (method === 'PUT') {
       // request.body is automatically parsed by Vercel if content-type is json
       // We need to stringify it back to send to WebDAV
       fetchOptions.body = JSON.stringify(request.body);
    }

    const davResponse = await fetch(targetUrl, fetchOptions);

    response.status(davResponse.status);
    
    // Handle 204 No Content
    if (davResponse.status === 204) {
        return response.end();
    }

    const text = await davResponse.text();
    
    // Try to return JSON if possible, otherwise text (e.g. for PROPFIND XML response)
    try {
        const json = JSON.parse(text);
        return response.json(json);
    } catch {
        return response.send(text);
    }

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return response.status(500).json({ error: 'Proxy Error', details: error.message });
  }
}