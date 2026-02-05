import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

// Configuration
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(process.cwd(), 'dist');
const DATA_DIR = path.join(process.cwd(), 'data');

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// SQLite Setup
const ensureDb = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const dbPath = path.join(DATA_DIR, 'local.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  return db;
};

// WebDAV Proxy Logic
const handleWebDav = async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filename = url.searchParams.get('filename') || '';
    
    // Load env vars (simple implementation, ideally use dotenv)
    // In production, these should be set in the system environment
    const { VITE_WEBDAV_URL, VITE_WEBDAV_USERNAME, VITE_WEBDAV_PASSWORD, VITE_WEBDAV_PATH } = process.env;

    if (!VITE_WEBDAV_URL || !VITE_WEBDAV_USERNAME || !VITE_WEBDAV_PASSWORD) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Missing WebDAV configuration in environment variables' }));
      return;
    }

    let method = req.method;
    if (req.headers['x-dav-method']) {
      const tunnelMethod = req.headers['x-dav-method'];
      method = Array.isArray(tunnelMethod) ? tunnelMethod[0] : tunnelMethod;
    }

    const cleanBaseUrl = VITE_WEBDAV_URL.replace(/\/+$/, '');
    const cleanPath = (VITE_WEBDAV_PATH || 'my-collection').replace(/^\/+|\/+$/g, '');
    let targetUrl = `${cleanBaseUrl}/${cleanPath}`;
    
    if (filename) {
      targetUrl += `/${filename}`;
    } else {
      targetUrl += '/';
    }

    const authHeader = 'Basic ' + Buffer.from(`${VITE_WEBDAV_USERNAME}:${VITE_WEBDAV_PASSWORD}`).toString('base64');
    
    const headers = {
      'Authorization': authHeader,
      'User-Agent': 'Mozilla/5.0 (Node.js) NicheCard/1.0'
    };

    if (req.headers['depth']) headers['Depth'] = req.headers['depth'];
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

    // Read body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length > 0 ? Buffer.concat(chunks) : null;

    const fetchOptions = {
      method: method,
      headers: headers,
      body: body
    };

    const davResponse = await fetch(targetUrl, fetchOptions);
    
    res.statusCode = davResponse.status;
    const contentType = davResponse.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    
    const arrayBuffer = await davResponse.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
    
  } catch (e) {
    console.error('WebDAV Proxy Error:', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
};

// SQLite API Logic
const handleSqlite = async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const db = ensureDb();

    // Handle Login
    if (url.pathname.endsWith('/login')) {
      if (req.method === 'POST') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());

        const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('private_data');
        const secrets = row ? JSON.parse(row.value) : { username: 'admin', password: 'password' };

        if (body.username === secrets.username && body.password === secrets.password) {
          const token = 'sqlite-' + Math.random().toString(36).slice(2) + Date.now();
          db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run('session_token', JSON.stringify({ token }));
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, token }));
        } else {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'Invalid credentials' }));
        }
      } else {
         res.statusCode = 405; res.end();
      }
      return;
    }

    const key = url.searchParams.get('key');
    
    if (!key) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing key parameter' }));
      return;
    }

    // Protect private_data
    if (key === 'private_data' && req.method === 'GET') {
        const auth = req.headers['authorization'];
        const tokenRow = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('session_token');
        const validToken = tokenRow ? JSON.parse(tokenRow.value).token : null;
        
        if (!validToken || auth !== validToken) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Unauthorized: Login required' }));
            return;
        }
    }

    if (req.method === 'GET') {
      const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
      const data = row ? JSON.parse(row.value) : null;
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data || null));
    } else if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const bodyStr = Buffer.concat(chunks).toString();
      // Validate JSON
      JSON.parse(bodyStr); 
      
      db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, bodyStr);
      
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true }));
    } else {
       res.statusCode = 405;
       res.end();
    }
    
  } catch (e) {
    console.error('SQLite Middleware Error:', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
};

// Main Server Handler
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // API Routes
  if (url.pathname.startsWith('/api/webdav')) {
    await handleWebDav(req, res);
    return;
  }
  
  if (url.pathname.startsWith('/api/sqlite')) {
    await handleSqlite(req, res);
    return;
  }

  // Static File Serving
  let filePath = path.join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  
  // Prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  // Check if file exists, if not serve index.html (SPA Fallback)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Should be handled by SPA fallback above, but just in case
        res.statusCode = 404;
        res.end('Not Found');
      } else {
        res.statusCode = 500;
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.setHeader('Content-Type', contentType);
      // Cache control for static assets (except index.html)
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
      }
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`- WebDAV Mode: ${process.env.VITE_WEBDAV_URL ? 'Enabled' : 'Disabled (Missing Env Vars)'}`);
  console.log(`- SQLite Mode: Enabled (Data: ${DATA_DIR})`);
});
