// Chapter 7 — serve the sample client website + SDK playground on localhost.
// (Microphone requires localhost or HTTPS, and Chrome.)
//
// Usage: npm run site   → http://localhost:8080/client-site.html
//                        → http://localhost:8080/sdk-playground.html?org=…&head=…&key=…
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT } from '../lib/unith.js';

const SITE_DIR = resolve(ROOT, '../demo-embed');
const PORT = Number(process.env.SITE_PORT ?? 8080);

createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  const file = path === '/' ? 'client-site.html' : path.slice(1);
  try {
    const body = await readFile(resolve(SITE_DIR, file));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, () => {
  console.log(`Client site  → http://localhost:${PORT}/client-site.html`);
  console.log(`SDK playground → http://localhost:${PORT}/sdk-playground.html?org=…&head=…&key=…`);
});
