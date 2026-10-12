/**
 * server.js – dev & serverless handler for Long Shot.
 *
 * Works both as a standalone Node server (`node server.js`)
 * and when Vercel runs it as a Serverless Function.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PORT = process.env.PORT || 3000;

const MIME = {
  html: 'text/html; charset=utf-8',
  js:   'application/javascript; charset=utf-8',
  mjs:  'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  css:  'text/css; charset=utf-8',
  png:  'image/png',
  webp: 'image/webp',
  svg:  'image/svg+xml',
  ogg:  'audio/ogg',
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  md:   'text/plain; charset=utf-8',
  ico:  'image/x-icon',
};

function handler(req, res) {
  const urlPath = req.url.split('?')[0];
  const cleanPath = urlPath.replace(/^\/+/, '');
  const relativePath = cleanPath === '' ? 'index.html' : cleanPath;
  const filePath = path.resolve(ROOT, relativePath);

  // Security: prevent path traversal out of ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${urlPath}`);
      return;
    }
    const ext  = path.extname(filePath).slice(1).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

// Export for serverless environments (e.g. Vercel)
module.exports = handler;

// If run directly, spin up HTTP listener
if (require.main === module) {
  http.createServer(handler).listen(PORT, () => {
    console.log(`\n🎯 Long Shot dev server running at:\n   http://localhost:${PORT}\n`);
  });
}
