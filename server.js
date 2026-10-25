'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function sendError(res, statusCode, message) {
  const body = `${statusCode} ${message}\n`;
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      sendError(res, 404, 'Not Found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        sendError(res, 500, 'Internal Server Error');
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  });
}

function resolveSafePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (err) {
    return null;
  }

  // Reject null bytes and normalize separators.
  if (decoded.includes('\0')) {
    return null;
  }

  const normalized = decoded.replace(/\\/g, '/');
  const resolved = path.resolve(PUBLIC_DIR, '.' + path.posix.normalize('/' + normalized));

  const relative = path.relative(PUBLIC_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return resolved;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    sendError(res, 405, 'Method Not Allowed');
    return;
  }

  let pathname;
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    pathname = url.pathname;
  } catch (err) {
    sendError(res, 400, 'Bad Request');
    return;
  }

  const resolved = resolveSafePath(pathname);
  if (resolved === null) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  fs.stat(resolved, (err, stats) => {
    if (!err && stats.isDirectory()) {
      // Directory request: serve index.html inside it.
      const indexPath = path.join(resolved, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (!indexErr && indexStats.isFile()) {
          sendFile(res, indexPath);
        } else {
          sendError(res, 404, 'Not Found');
        }
      });
      return;
    }

    if (!err && stats.isFile()) {
      sendFile(res, resolved);
      return;
    }

    // SPA fallback: serve public/index.html for unknown paths.
    const fallback = path.join(PUBLIC_DIR, 'index.html');
    fs.stat(fallback, (fallbackErr, fallbackStats) => {
      if (!fallbackErr && fallbackStats.isFile()) {
        sendFile(res, fallback);
      } else {
        sendError(res, 404, 'Not Found');
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}/`);
  console.log(`Serving files from ${PUBLIC_DIR}`);
});