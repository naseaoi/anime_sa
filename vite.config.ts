import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// SQLite Helper Logic (Embedded for stability in dev environment)
const ensureDb = () => {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'local.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  return db;
};

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    plugins: [
      react(),
      {
        name: 'configure-server',
        configureServer(server) {
          // WebDAV Proxy Middleware
          server.middlewares.use('/api/webdav', async (req, res, next) => {
            try {
              const url = new URL(req.url || '', `http://${req.headers.host}`);
              const filename = url.searchParams.get('filename') || '';
              
              const { VITE_WEBDAV_URL, VITE_WEBDAV_USERNAME, VITE_WEBDAV_PASSWORD, VITE_WEBDAV_PATH } = env;

              if (!VITE_WEBDAV_URL || !VITE_WEBDAV_USERNAME || !VITE_WEBDAV_PASSWORD) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Missing WebDAV configuration in .env' }));
                return;
              }

              // Method Tunneling logic
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
              
              const headers: Record<string, string> = {
                'Authorization': authHeader,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
              };

              if (req.headers['depth']) headers['Depth'] = req.headers['depth'] as string;
              if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'] as string;

              // Read body if necessary
              let body: any = null;
              if (['PUT', 'PROPPATCH', 'POST'].includes(method || '') && req.method !== 'GET' && req.method !== 'HEAD') {
                const chunks: any[] = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                body = Buffer.concat(chunks);
              }

              const fetchOptions: RequestInit = {
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
              
            } catch (e: any) {
              console.error('Dev Proxy Error:', e);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });

          // SQLite API Middleware
          server.middlewares.use('/api/sqlite', async (req, res, next) => {
            try {
              const url = new URL(req.url || '', `http://${req.headers.host}`);
              const db = ensureDb();

              // Handle Login
              // Vite middleware might strip the mount path, so we check endsWith or both variants
              if (url.pathname.endsWith('/login')) {
                if (req.method === 'POST') {
                  const chunks: any[] = [];
                  for await (const chunk of req) chunks.push(chunk);
                  const body = JSON.parse(Buffer.concat(chunks).toString());

                  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('private_data') as { value: string } | undefined;
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
                  const tokenRow = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('session_token') as { value: string } | undefined;
                  const validToken = tokenRow ? JSON.parse(tokenRow.value).token : null;
                  
                  if (!validToken || auth !== validToken) {
                      res.statusCode = 401;
                      res.end(JSON.stringify({ error: 'Unauthorized: Login required' }));
                      return;
                  }
              }

              if (req.method === 'GET') {
                const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as { value: string } | undefined;
                const data = row ? JSON.parse(row.value) : null;
                
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data || null));
              } else if (req.method === 'POST') {
                const chunks: any[] = [];
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
              
            } catch (e: any) {
              console.error('SQLite Middleware Error:', e);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        }
      }
    ],
  }
})