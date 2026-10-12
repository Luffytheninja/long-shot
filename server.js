/**
 * server.js – tiny local dev server for Long Shot.
 *
 * Serves files with correct MIME types so ES modules work in the browser.
 * Run with: node server.js
 * Then open:  http://localhost:3000
 *
 * This is only for local preview – Vercel handles production serving.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const MIME = {
  html: 'text/html',
  js:   'application/javascript',
  mjs:  'application/javascript',
  json: 'application/json',
  css:  'text/css',
  png:  'image/png',
  webp: 'image/webp',
  svg:  'image/svg+xml',
  ogg:  'audio/ogg',
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  md:   'text/plain',
  ico:  'image/x-icon',
};

http.createServer((req, res) => {
  // Strip query string
  const urlPath = req.url.split('?')[0];
  const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
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
}).listen(PORT, () => {
  console.log(`\n🎯 Long Shot dev server running at:\n   http://localhost:${PORT}\n`);
  console.log('   Open in Chrome, then use DevTools → device toolbar\n   to emulate 375×812 portrait (iPhone XR).\n');
});
